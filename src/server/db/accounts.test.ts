import { describe, expect, it } from "vitest";
import {
  findAccount,
  listAccounts,
  purgeDueAccounts,
  scheduleAccountDeletion,
  updateAccount,
} from "./accounts";
import { makeFakeDb } from "./fake-db";
import { EmailAlreadyUsedError } from "./users";

const ID = "00000000-0000-4000-8000-000000000002";
const BASE = {
  id: ID,
  email: "alex@example.test",
  role: "user",
  firstname: "Alex",
  lastname: "Martin",
  created_at: new Date("2026-01-01T00:00:00Z"),
  last_seen_at: new Date("2026-11-07T08:00:00Z"),
  blocked_at: null,
  blocked_until: null,
  deletion_due_at: null,
};

describe("listAccounts", () => {
  it("renvoie les comptes avec leur état et leur dernière activité, sans hash", async () => {
    const { db, query } = makeFakeDb([BASE]);
    expect(await listAccounts(db)).toEqual([
      {
        id: ID,
        email: "alex@example.test",
        role: "user",
        firstname: "Alex",
        lastname: "Martin",
        createdAt: BASE.created_at,
        lastSeenAt: BASE.last_seen_at,
        state: { blockedAt: null, blockedUntil: null, deletionDueAt: null },
      },
    ]);
    expect(query.mock.calls[0]?.[0]).not.toContain("password_hash");
    expect(query.mock.calls[0]?.[0]).toContain("max(s.last_seen_at)");
  });
});

describe("findAccount", () => {
  it("compte les données actives qui seraient effacées", async () => {
    const { db } = makeFakeDb([
      { ...BASE, compensations: 12, games: 8, notes: 5, scales: 1, colleagues: 3 },
    ]);
    expect((await findAccount(db, ID))?.contents).toEqual({
      compensations: 12,
      games: 8,
      notes: 5,
      scales: 1,
      colleagues: 3,
    });
  });

  it("null si le compte n'existe pas", async () => {
    const { db } = makeFakeDb();
    expect(await findAccount(db, ID)).toBeNull();
  });
});

describe("updateAccount", () => {
  it("traduit la violation d'unicité de l'email", async () => {
    const { db, query } = makeFakeDb();
    query.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));
    await expect(
      updateAccount(db, {
        accountId: ID,
        firstname: "A",
        lastname: "M",
        email: "x@y.z",
        role: "user",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyUsedError);
  });
});

describe("scheduleAccountDeletion", () => {
  it("ne reprogramme pas une suppression déjà en cours", async () => {
    const { db, query } = makeFakeDb();
    expect(await scheduleAccountDeletion(db, { accountId: ID, days: 30 })).toBeNull();
    expect(query.mock.calls[0]?.[0]).toContain("deletion_due_at IS NULL");
  });
});

describe("purgeDueAccounts", () => {
  it("efface seulement les comptes dont la suppression est due", async () => {
    const { db, query } = makeFakeDb([{ id: ID }]);
    expect(await purgeDueAccounts(db)).toEqual([ID]);
    expect(query.mock.calls[0]?.[0]).toContain(
      "deletion_due_at IS NOT NULL AND deletion_due_at <= now()",
    );
  });
});
