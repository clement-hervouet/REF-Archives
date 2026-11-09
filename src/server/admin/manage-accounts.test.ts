import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  handleBlockAccount,
  handleCancelDeletion,
  handleIssuePasswordReset,
  handleScheduleDeletion,
  handleUnblockAccount,
  handleUpdateAccount,
} from "./manage-accounts";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const TARGET = "00000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-11-08T19:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET,
    email: "alex@example.test",
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

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
    now: () => NOW,
    generateToken: () => ({ token: "jeton-secret", hash: Buffer.alloc(32, 7) }),
  };
  return { deps, query };
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

const EDIT = { accountId: TARGET, firstname: "Alex", lastname: "Martin", role: "user" };

describe("handleUpdateAccount", () => {
  it("modifie et signale l'ancienne adresse quand l'email change", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row()] })
      .mockResolvedValueOnce({ rows: [{ id: TARGET }] });
    expect(
      await handleUpdateAccount(deps, ADMIN, form({ ...EDIT, email: "Nouvelle@Example.test" })),
    ).toEqual({
      status: "updated",
      accountId: TARGET,
      previousEmail: "alex@example.test",
      email: "nouvelle@example.test",
    });
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[1]?.[1]).toEqual([
      TARGET,
      "Alex",
      "Martin",
      "nouvelle@example.test",
      "user",
    ]);
  });

  it("même adresse : pas d'alerte", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row()] })
      .mockResolvedValueOnce({ rows: [{ id: TARGET }] });
    const result = await handleUpdateAccount(
      deps,
      ADMIN,
      form({ ...EDIT, email: "ALEX@example.test" }),
    );
    expect(result).toMatchObject({ status: "updated", previousEmail: null });
  });

  it("refuse de retirer ses propres droits d'admin", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row({ id: ADMIN, role: "admin" })] });
    expect(
      await handleUpdateAccount(
        deps,
        ADMIN,
        form({ ...EDIT, accountId: ADMIN, email: "a@example.test" }),
      ),
    ).toEqual({ status: "self_demotion" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse de rétrograder le dernier admin actif", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row({ role: "admin" })] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await handleUpdateAccount(deps, ADMIN, form({ ...EDIT, email: "alex@example.test" })),
    ).toEqual({
      status: "last_admin",
    });
    expect(query.mock.calls[1]?.[0]).toContain("role = 'admin'");
  });

  it("email déjà pris : refus propre", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row()] })
      .mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }));
    expect(
      await handleUpdateAccount(deps, ADMIN, form({ ...EDIT, email: "pris@example.test" })),
    ).toEqual({
      status: "email_taken",
    });
  });

  it("champs invalides : aucune requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleUpdateAccount(deps, ADMIN, form({ ...EDIT, firstname: "", email: "x" })),
    ).toEqual({
      status: "invalid",
      issues: ["firstname.required", "email.invalid"],
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("handleBlockAccount", () => {
  it("bloque 7 jours et ferme toutes les sessions", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row()] });
    expect(await handleBlockAccount(deps, ADMIN, form({ accountId: TARGET, mode: "7d" }))).toEqual({
      status: "blocked",
      accountId: TARGET,
      until: new Date("2026-11-15T19:00:00Z"),
    });
    expect(query.mock.calls[1]?.[0]).toContain("blocked_at = now()");
    expect(query.mock.calls[1]?.[1]).toEqual([TARGET, new Date("2026-11-15T19:00:00Z")]);
    expect(query.mock.calls[2]?.[0]).toContain("UPDATE session");
    expect(query.mock.calls[2]?.[1]).toEqual([TARGET, null]);
  });

  it("sans fin : fin NULL", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row()] });
    expect(
      await handleBlockAccount(deps, ADMIN, form({ accountId: TARGET, mode: "indefinite" })),
    ).toMatchObject({
      status: "blocked",
      until: null,
    });
  });

  it("refuse de se bloquer soi-même", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row({ id: ADMIN, role: "admin" })] });
    expect(await handleBlockAccount(deps, ADMIN, form({ accountId: ADMIN, mode: "24h" }))).toEqual({
      status: "self",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse de bloquer le dernier admin actif", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row({ role: "admin" })] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await handleBlockAccount(deps, ADMIN, form({ accountId: TARGET, mode: "24h" }))).toEqual(
      {
        status: "last_admin",
      },
    );
  });

  it("autre admin actif : le blocage passe", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row({ role: "admin" })] })
      .mockResolvedValueOnce({ rows: [{ id: ADMIN }] });
    expect(
      (await handleBlockAccount(deps, ADMIN, form({ accountId: TARGET, mode: "24h" }))).status,
    ).toBe("blocked");
  });

  it("suppression programmée : blocage refusé", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({
      rows: [row({ deletion_due_at: new Date("2026-12-01T00:00:00Z") })],
    });
    expect(await handleBlockAccount(deps, ADMIN, form({ accountId: TARGET, mode: "24h" }))).toEqual(
      {
        status: "deletion_pending",
      },
    );
  });

  it("date passée : refus sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleBlockAccount(
        deps,
        ADMIN,
        form({ accountId: TARGET, mode: "date", date: "2026-11-01" }),
      ),
    ).toEqual({ status: "invalid", issue: "date.past" });
    expect(query).not.toHaveBeenCalled();
  });

  it("débloquer", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: TARGET }] });
    expect(await handleUnblockAccount(deps, form({ accountId: TARGET }))).toEqual({
      status: "unblocked",
      accountId: TARGET,
    });
    expect(query.mock.calls[0]?.[0]).toContain("blocked_at = NULL");
  });
});

describe("handleScheduleDeletion", () => {
  const DUE = new Date("2026-12-08T19:00:00Z");

  it("programme dans 30 jours après confirmation par l'email, et ferme les sessions", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row()] })
      .mockResolvedValueOnce({ rows: [{ deletion_due_at: DUE }] });
    expect(
      await handleScheduleDeletion(
        deps,
        ADMIN,
        form({ accountId: TARGET, confirmEmail: " ALEX@example.test " }),
      ),
    ).toEqual({ status: "scheduled", accountId: TARGET, dueAt: DUE });
    expect(query.mock.calls[1]?.[1]).toEqual([TARGET, 30]);
    expect(query.mock.calls[2]?.[0]).toContain("UPDATE session");
  });

  it("email de confirmation différent : refus, rien n'est écrit", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row()] });
    expect(
      await handleScheduleDeletion(
        deps,
        ADMIN,
        form({ accountId: TARGET, confirmEmail: "autre@example.test" }),
      ),
    ).toEqual({ status: "confirmation_mismatch" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse de se supprimer soi-même", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row({ id: ADMIN, email: "dev@example.test" })] });
    expect(
      await handleScheduleDeletion(
        deps,
        ADMIN,
        form({ accountId: ADMIN, confirmEmail: "dev@example.test" }),
      ),
    ).toEqual({ status: "self" });
  });

  it("déjà programmée : la date ne recule pas", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [row({ deletion_due_at: DUE })] });
    expect(
      await handleScheduleDeletion(
        deps,
        ADMIN,
        form({ accountId: TARGET, confirmEmail: "alex@example.test" }),
      ),
    ).toEqual({ status: "scheduled", accountId: TARGET, dueAt: DUE });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("annuler", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: TARGET }] });
    expect(await handleCancelDeletion(deps, form({ accountId: TARGET }))).toEqual({
      status: "cancelled",
      accountId: TARGET,
    });
  });
});

describe("handleIssuePasswordReset", () => {
  it("crée un lien (un seul actif) et renvoie le jeton pour l'email", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [row()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "00000000-0000-4000-8000-0000000000aa", expires_at: NOW }],
      });
    expect(await handleIssuePasswordReset(deps, form({ accountId: TARGET }))).toEqual({
      status: "issued",
      accountId: TARGET,
      email: "alex@example.test",
      token: "jeton-secret",
    });
    expect(query.mock.calls[1]?.[1]).toEqual([TARGET]);
    expect(query.mock.calls[2]?.[1]?.[1]).toEqual(Buffer.alloc(32, 7));
  });

  it("suppression programmée : refus", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({
      rows: [row({ deletion_due_at: new Date("2026-12-01T00:00:00Z") })],
    });
    expect(await handleIssuePasswordReset(deps, form({ accountId: TARGET }))).toEqual({
      status: "deletion_pending",
    });
  });

  it("identifiant mal formé : introuvable", async () => {
    const { deps } = setup();
    expect(await handleIssuePasswordReset(deps, form({ accountId: "x" }))).toEqual({
      status: "not_found",
    });
  });
});
