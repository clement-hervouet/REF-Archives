import { describe, expect, it, vi } from "vitest";
import type { AttemptDecision } from "../auth/rate-limit";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable, UserCredentials } from "../db/users";
import { changePasswordKeys, handleChangePassword } from "./change-password";

const USER = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "alex@example.test",
  sessionId: "11111111-1111-4111-8111-111111111111",
};
const IP = "203.0.113.7";
const NOW = new Date("2026-11-12T19:00:00Z");
const HASH = "$argon2id$hash-actuel";
const NEW_HASH = "$argon2id$hash-nouveau";
const CURRENT = "mon-mot-de-passe-actuel";
const NEW_PASSWORD = "mon-nouveau-mot-de-passe-costaud";

const CREDENTIALS: UserCredentials = {
  userId: USER.id,
  passwordHash: HASH,
  state: { blockedAt: null, blockedUntil: null, deletionDueAt: null },
};

/**
 * `verifyResults` : réponses successives de `verifyPassword` (1er appel = mot de passe
 * actuel, 2e = nouveau comparé à l'ancien). `admitted` par défaut : tentative admise.
 */
function setup(
  options: { admitted?: AttemptDecision; verifyResults?: boolean[] } = {},
) {
  const { db, query } = makeFakeDb();
  const admitAttempt = vi
    .fn<(keys: string[], now: Date) => Promise<AttemptDecision>>()
    .mockResolvedValue(options.admitted ?? { admitted: true });
  const findCredentials = vi
    .fn<(email: string) => Promise<UserCredentials | null>>()
    .mockResolvedValue(CREDENTIALS);
  const verifyPassword = vi.fn<(hash: string, password: string) => Promise<boolean>>();
  for (const result of options.verifyResults ?? []) {
    verifyPassword.mockResolvedValueOnce(result);
  }
  const hashPassword = vi.fn<(password: string) => Promise<string>>().mockResolvedValue(NEW_HASH);
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
    hashPassword,
  };
  return { deps, query, admitAttempt, findCredentials, verifyPassword, hashPassword, transactions: () => transactions };
}

function form(fields: { current?: string | null; next?: string | null; confirmation?: string | null }): FormData {
  const data = new FormData();
  if (fields.current != null) data.set("currentPassword", fields.current);
  if (fields.next != null) data.set("newPassword", fields.next);
  if (fields.confirmation != null) data.set("confirmation", fields.confirmation);
  return data;
}

function valid(overrides: Partial<{ current: string; next: string; confirmation: string }> = {}): FormData {
  return form({ current: CURRENT, next: NEW_PASSWORD, confirmation: NEW_PASSWORD, ...overrides });
}

describe("changePasswordKeys", () => {
  it("une clé par compte et une par IP, sans identifiant ni IP en clair", () => {
    const keys = changePasswordKeys(USER.id, IP);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^password-change:user:[0-9a-f]{64}$/);
    expect(keys[1]).toMatch(/^password-change:ip:[0-9a-f]{64}$/);
    expect(keys.join()).not.toContain(USER.id);
    expect(keys.join()).not.toContain(IP);
  });
});

describe("handleChangePassword", () => {
  it("succès : nouveau hash, garde l'appareil courant et coupe les autres sessions", async () => {
    const { deps, query, admitAttempt, hashPassword } = setup({ verifyResults: [true, false] });
    query
      .mockResolvedValueOnce({ rows: [{ email: USER.email }] }) // updateUserPasswordHash
      .mockResolvedValueOnce({ rows: [] }); // revokeAllUserSessions
    expect(await handleChangePassword(deps, USER, IP, valid())).toEqual({
      status: "changed",
      email: USER.email,
    });
    expect(admitAttempt).toHaveBeenCalledWith(changePasswordKeys(USER.id, IP), NOW);
    expect(hashPassword).toHaveBeenCalledWith(NEW_PASSWORD);
    // Mise à jour du hash : [userId, nouveau hash].
    expect(query.mock.calls[0]?.[0]).toContain("password_hash");
    expect(query.mock.calls[0]?.[1]).toEqual([USER.id, NEW_HASH]);
    // Révocation : l'appareil COURANT est exclu (exceptSessionId = session courante).
    expect(query.mock.calls[1]?.[0]).toContain("revoked_at = now()");
    expect(query.mock.calls[1]?.[1]).toEqual([USER.id, USER.sessionId]);
  });

  it("mot de passe actuel absent ou vide : refusé sans compter de tentative", async () => {
    for (const current of [null, ""]) {
      const { deps, admitAttempt } = setup();
      expect(
        await handleChangePassword(deps, USER, IP, form({ current, next: NEW_PASSWORD, confirmation: NEW_PASSWORD })),
      ).toEqual({ status: "invalid" });
      expect(admitAttempt).not.toHaveBeenCalled();
    }
  });

  it("nouveau mot de passe trop court : refusé avec le code de la politique", async () => {
    const { deps, admitAttempt } = setup();
    const result = await handleChangePassword(deps, USER, IP, valid({ next: "court", confirmation: "court" }));
    expect(result).toEqual({ status: "invalid_password", issues: ["password.too_short"] });
    expect(admitAttempt).not.toHaveBeenCalled();
  });

  it("confirmation différente : refusé sans compter de tentative", async () => {
    const { deps, admitAttempt } = setup();
    expect(
      await handleChangePassword(deps, USER, IP, valid({ confirmation: "autre-chose-longue-12" })),
    ).toEqual({ status: "mismatch" });
    expect(admitAttempt).not.toHaveBeenCalled();
  });

  it("trop de tentatives : refusé avant toute vérification", async () => {
    const { deps, verifyPassword } = setup({ admitted: { admitted: false, retryAfterSeconds: 61 } });
    expect(await handleChangePassword(deps, USER, IP, valid())).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 61,
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("mauvais mot de passe actuel : rien n'est modifié", async () => {
    const { deps, query, transactions } = setup({ verifyResults: [false] });
    expect(await handleChangePassword(deps, USER, IP, valid())).toEqual({ status: "wrong_password" });
    expect(query).not.toHaveBeenCalled();
    expect(transactions()).toBe(0);
  });

  it("nouveau identique à l'actuel : refusé", async () => {
    const { deps, query, transactions } = setup({ verifyResults: [true, true] });
    expect(await handleChangePassword(deps, USER, IP, valid())).toEqual({ status: "same_password" });
    expect(query).not.toHaveBeenCalled();
    expect(transactions()).toBe(0);
  });

  it("identifiants d'un autre compte (email changé entre-temps) : introuvable", async () => {
    const { deps, findCredentials, verifyPassword } = setup();
    findCredentials.mockResolvedValueOnce({ ...CREDENTIALS, userId: "autre" });
    expect(await handleChangePassword(deps, USER, IP, valid())).toEqual({ status: "not_found" });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("compte disparu pendant la transaction : introuvable", async () => {
    const { deps, query } = setup({ verifyResults: [true, false] });
    query.mockResolvedValueOnce({ rows: [] }); // updateUserPasswordHash : aucune ligne
    expect(await handleChangePassword(deps, USER, IP, valid())).toEqual({ status: "not_found" });
  });
});
