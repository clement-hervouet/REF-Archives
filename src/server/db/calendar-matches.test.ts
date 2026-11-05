import { describe, expect, it } from "vitest";
import { MAX_COMPENSATIONS_PER_USER } from "./compensations";
import { makeFakeDb } from "./fake-db";
import { findCalendarMatch, listCalendarMatchesSince } from "./calendar-matches";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const COMPENSATION_ID = "8c2d4f6a-1b3e-4a5c-9d7e-0f1a2b3c4d5e";
const FROM = new Date("2025-11-05T17:00:00.000Z");

const ROW = {
  id: COMPENSATION_ID,
  starts_at: new Date("2026-11-06T19:30:00.000Z"),
  updated_at: new Date("2026-11-01T10:00:00.000Z"),
  division: "Regional",
  type: "Masculin",
  level: "2",
  team1_name: "BC Béthune",
  team2_name: "US Arras",
  street: "Avenue du Sport",
  number: "2",
  postal_code: "62400",
  city: "Béthune",
};

const MATCH = {
  id: COMPENSATION_ID,
  startsAt: ROW.starts_at,
  updatedAt: ROW.updated_at,
  division: { category: "Regional", type: "Masculin", level: "2" },
  team1Name: "BC Béthune",
  team2Name: "US Arras",
  address: { street: "Avenue du Sport", number: "2", postalCode: "62400", city: "Béthune" },
};

describe("listCalendarMatchesSince", () => {
  it("renvoie les matchs de l'utilisateur depuis la date donnée", async () => {
    const { db, query } = makeFakeDb([ROW]);
    expect(await listCalendarMatchesSince(db, { userId: USER_ID, from: FROM })).toEqual([MATCH]);
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID, FROM, MAX_COMPENSATIONS_PER_USER]);
  });

  it("filtre par propriétaire, exclut les supprimées et ne lit aucun montant", async () => {
    const { db, query } = makeFakeDb();
    await listCalendarMatchesSince(db, { userId: USER_ID, from: FROM });
    const sql = query.mock.lastCall?.[0] ?? "";
    expect(sql).toContain("c.user_id = $1");
    expect(sql).toContain("c.deleted_at IS NULL");
    expect(sql).not.toContain("scale_rate");
    expect(sql).not.toContain("distance_m");
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([{ ...ROW, level: "U99" }]);
    await expect(listCalendarMatchesSince(db, { userId: USER_ID, from: FROM })).rejects.toThrow();
  });
});

describe("findCalendarMatch", () => {
  it("renvoie le match de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([ROW]);
    expect(
      await findCalendarMatch(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toEqual(MATCH);
    expect(query.mock.lastCall?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });

  it("renvoie null pour un match introuvable", async () => {
    const { db } = makeFakeDb();
    expect(
      await findCalendarMatch(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toBeNull();
  });
});
