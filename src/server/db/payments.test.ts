import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  clearCompensationPayment,
  listUnpaidPlayedCompensations,
  markCompensationsPaid,
} from "./payments";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const ID1 = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";
const ID2 = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f02";

describe("listUnpaidPlayedCompensations", () => {
  it("filtre par utilisateur, non payées, actives, déjà commencées, et structure les lignes", async () => {
    const startsAt = new Date("2026-10-10T18:30:00Z");
    const before = new Date("2026-11-06T10:00:00Z");
    const { db, query } = makeFakeDb([
      {
        id: ID1,
        starts_at: startsAt,
        distance_m: 24_000,
        division: "Regional",
        type: "Masculin",
        level: "1",
        team1_name: "Club Beta",
        team2_name: "Club Alpha",
        game_amount_cents: 3000,
        cents_per_km: "40.00",
        payer_override: null,
        postal_code: "62000",
        country: null,
      },
    ]);
    expect(await listUnpaidPlayedCompensations(db, { userId: USER_ID, before })).toEqual([
      {
        id: ID1,
        startsAt,
        division: { category: "Regional", type: "Masculin", level: "1" },
        team1Name: "Club Beta",
        team2Name: "Club Alpha",
        distanceM: 24_000,
        gameAmountCents: 3000,
        centsPerKm: "40.00",
        payer: { kind: "league", league: "hauts-de-france" },
      },
    ]);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("c.user_id = $1");
    expect(sql).toContain("c.paid_on IS NULL");
    expect(sql).toContain("c.deleted_at IS NULL");
    expect(sql).toContain("c.starts_at < $2");
    expect(sql).toContain("club1.user_id = c.user_id");
    expect(sql).toContain("a.user_id = c.user_id");
    expect(values).toEqual([USER_ID, before]);
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([{ id: "pas-un-uuid" }]);
    await expect(
      listUnpaidPlayedCompensations(db, { userId: USER_ID, before: new Date() }),
    ).rejects.toThrow();
  });
});

describe("markCompensationsPaid", () => {
  it("met à jour la sélection de l'utilisateur et renvoie le nombre modifié", async () => {
    const { db, query } = makeFakeDb([{ id: ID1 }]);
    expect(
      await markCompensationsPaid(db, {
        userId: USER_ID,
        compensationIds: [ID1, ID2],
        paidOn: "2026-11-05",
      }),
    ).toBe(1);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("user_id = $1");
    expect(sql).toContain("id = ANY($2::uuid[])");
    expect(sql).toContain("paid_on IS NULL");
    expect(sql).toContain("deleted_at IS NULL");
    expect(values).toEqual([USER_ID, [ID1, ID2], "2026-11-05"]);
  });

  it("refuse une date mal formée sans toucher à la base", async () => {
    const { db, query } = makeFakeDb();
    await expect(
      markCompensationsPaid(db, { userId: USER_ID, compensationIds: [ID1], paidOn: "05/11/2026" }),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});

describe("clearCompensationPayment", () => {
  it("annule le paiement d'une indemnité de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([{ id: ID1 }]);
    expect(await clearCompensationPayment(db, { userId: USER_ID, compensationId: ID1 })).toBe(true);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("SET paid_on = NULL");
    expect(sql).toContain("user_id = $2");
    expect(values).toEqual([ID1, USER_ID]);
  });

  it("renvoie false si elle n'était pas payée, n'existe pas ou n'est pas à lui", async () => {
    const { db } = makeFakeDb();
    expect(await clearCompensationPayment(db, { userId: USER_ID, compensationId: ID1 })).toBe(
      false,
    );
  });
});
