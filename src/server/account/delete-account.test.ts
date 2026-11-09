import { describe, expect, it, vi } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable, UserCredentials } from "../db/users";
import type { AttemptDecision } from "../auth/rate-limit";
import { handleSelfDeletion, selfDeletionKeys } from "./delete-account";

const USER = { id: "00000000-0000-4000-8000-000000000002", email: "alex@example.test" };
const IP = "203.0.113.7";
const NOW = new Date("2026-11-09T19:00:00Z");
const DUE = new Date("2026-12-09T19:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: USER.id,
    email: USER.email,
    role: "user",
    firstname: "Alex",
    lastname: "Martin",
    created_at: new Date("2026-01-01T00:00:00Z"),
    last_seen_at: null,
    blocked_at: null,
    blocked_until: null,
    deletion_due_at: null,
    ...overrides,
  };
}

const CREDENTIALS: UserCredentials = {
  userId: USER.id,
  passwordHash: "$argon2id$hash",
  state: { blockedAt: null, blockedUntil: null, deletionDueAt: null },
};

function setup(options: { admitted?: AttemptDecision; passwordOk?: boolean } = {}) {
  const { db, query } = makeFakeDb();
  const admitAttempt = vi
    .fn<(keys: string[], now: Date) => Promise<AttemptDecision>>()
    .mockResolvedValue(options.admitted ?? { admitted: true });
  const findCredentials = vi
    .fn<(email: string) => Promise<UserCredentials | null>>()
    .mockResolvedValue(CREDENTIALS);
  const verifyPassword = vi
    .fn<(hash: string, password: string) => Promise<boolean>>()
    .mockResolvedValue(options.passwordOk ?? true);
  let transactions = 0;
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => {
      transactions += 1;
      return action(db);
    },
    now: () => NOW,
    admitAttempt,
    findCredentials,
    verifyPassword,
  };
  return {
    deps,
    query,
    admitAttempt,
    findCredentials,
    verifyPassword,
    transactions: () => transactions,
  };
}

function form(password: string | null): FormData {
  const data = new FormData();
  if (password !== null) data.set("password", password);
  return data;
}

describe("selfDeletionKeys", () => {
  it("une clé par compte et une par IP, sans identifiant ni IP en clair", () => {
    const keys = selfDeletionKeys(USER.id, IP);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^account-deletion:user:[0-9a-f]{64}$/);
    expect(keys[1]).toMatch(/^account-deletion:ip:[0-9a-f]{64}$/);
    expect(keys.join()).not.toContain(USER.id);
    expect(keys.join()).not.toContain(IP);
  });
});

describe("handleSelfDeletion", () => {
  it("mot de passe correct : programme la suppression à 30 jours et ferme toutes les sessions", async () => {
    const { deps, query, admitAttempt, verifyPassword } = setup();
    query
      .mockResolvedValueOnce({ rows: [row()] })
      .mockResolvedValueOnce({ rows: [{ deletion_due_at: DUE }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await handleSelfDeletion(deps, USER, IP, form("mon-mot-de-passe"))).toEqual({
      status: "scheduled",
      dueAt: DUE,
      email: USER.email,
    });
    expect(admitAttempt).toHaveBeenCalledWith(selfDeletionKeys(USER.id, IP), NOW);
    expect(verifyPassword).toHaveBeenCalledWith(CREDENTIALS.passwordHash, "mon-mot-de-passe");
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[1]?.[1]).toEqual([USER.id, 30]);
    expect(query.mock.calls[2]?.[0]).toContain("revoked_at = now()");
    expect(query.mock.calls[2]?.[1]).toEqual([USER.id, null]);
  });

  it("mot de passe vide ou absent : refusé sans compter de tentative", async () => {
    for (const password of ["", null]) {
      const { deps, admitAttempt } = setup();
      expect(await handleSelfDeletion(deps, USER, IP, form(password))).toEqual({
        status: "invalid",
      });
      expect(admitAttempt).not.toHaveBeenCalled();
    }
  });

  it("mot de passe trop long : refusé avant argon2", async () => {
    const { deps, verifyPassword } = setup();
    expect(await handleSelfDeletion(deps, USER, IP, form("x".repeat(129)))).toEqual({
      status: "invalid",
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("trop de tentatives : refusé avant la vérification du mot de passe", async () => {
    const { deps, verifyPassword } = setup({
      admitted: { admitted: false, retryAfterSeconds: 61 },
    });
    expect(await handleSelfDeletion(deps, USER, IP, form("mon-mot-de-passe"))).toEqual({
      status: "rate_limited",
      retryAfterMinutes: 2,
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("mauvais mot de passe : rien n'est modifié", async () => {
    const { deps, query, transactions } = setup({ passwordOk: false });
    expect(await handleSelfDeletion(deps, USER, IP, form("faux"))).toEqual({
      status: "wrong_password",
    });
    expect(query).not.toHaveBeenCalled();
    expect(transactions()).toBe(0);
  });

  it("identifiants d'un autre compte (email changé entre-temps) : introuvable", async () => {
    const { deps, findCredentials, verifyPassword } = setup();
    findCredentials.mockResolvedValueOnce({ ...CREDENTIALS, userId: "autre" });
    expect(await handleSelfDeletion(deps, USER, IP, form("mon-mot-de-passe"))).toEqual({
      status: "not_found",
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("compte disparu : introuvable", async () => {
    const { deps, findCredentials } = setup();
    findCredentials.mockResolvedValueOnce(null);
    expect(await handleSelfDeletion(deps, USER, IP, form("mon-mot-de-passe"))).toEqual({
      status: "not_found",
    });
  });

  it("suppression déjà programmée : la date ne recule pas", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row({ deletion_due_at: DUE })] });
    expect(await handleSelfDeletion(deps, USER, IP, form("mon-mot-de-passe"))).toEqual({
      status: "scheduled",
      dueAt: DUE,
      email: USER.email,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("dernier admin actif : refusé", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row({ role: "admin" })] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await handleSelfDeletion(deps, USER, IP, form("mon-mot-de-passe"))).toEqual({
      status: "last_admin",
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("admin quand un autre admin actif existe : programmé", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row({ role: "admin" })] })
      .mockResolvedValueOnce({ rows: [{ id: "00000000-0000-4000-8000-000000000001" }] })
      .mockResolvedValueOnce({ rows: [{ deletion_due_at: DUE }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await handleSelfDeletion(deps, USER, IP, form("mon-mot-de-passe"))).toMatchObject({
      status: "scheduled",
    });
  });
});
