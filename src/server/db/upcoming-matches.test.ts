import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import { listUpcomingMatches } from "./upcoming-matches";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";

const BASE_ROW = {
  id: COMPENSATION_ID,
  starts_at: new Date("2026-11-07T19:30:00Z"),
  division: "Regional",
  type: "Feminin",
  level: "U15",
  team1_name: "BC Béthune",
  team2_name: "ES Lens",
  street: "Rue du Stade",
  number: "2",
  postal_code: "62400",
  city: "Béthune",
};

describe("listUpcomingMatches", () => {
  it("renvoie les matchs de la période avec leurs officiels dans l'ordre", async () => {
    const from = new Date("2026-11-05T23:00:00Z");
    const to = new Date("2026-11-08T23:00:00Z");
    const { db, query } = makeFakeDb([
      {
        ...BASE_ROW,
        game_id: GAME_ID,
        officials: [
          { slot: "referee1", is_self: false, firstname: "Alex", lastname: "Martin" },
          { slot: "referee2", is_self: true, firstname: null, lastname: null },
        ],
      },
    ]);
    expect(await listUpcomingMatches(db, { userId: USER_ID, from, to })).toEqual([
      {
        id: COMPENSATION_ID,
        startsAt: new Date("2026-11-07T19:30:00Z"),
        division: { category: "Regional", type: "Feminin", level: "U15" },
        team1Name: "BC Béthune",
        team2Name: "ES Lens",
        address: { street: "Rue du Stade", number: "2", postalCode: "62400", city: "Béthune" },
        gameId: GAME_ID,
        officials: [
          { slot: "referee1", isSelf: false, firstname: "Alex", lastname: "Martin" },
          { slot: "referee2", isSelf: true, firstname: null, lastname: null },
        ],
      },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, from, to]);
    expect(query.mock.calls[0]?.[0]).toContain("g.deleted_at IS NULL");
  });

  it("sans match complet : aucun officiel", async () => {
    const { db } = makeFakeDb([{ ...BASE_ROW, game_id: null, officials: [] }]);
    const [match] = await listUpcomingMatches(db, {
      userId: USER_ID,
      from: new Date(),
      to: new Date(),
    });
    expect(match?.gameId).toBeNull();
    expect(match?.officials).toEqual([]);
  });

  it("ne lit aucun montant ni barème", async () => {
    const { db, query } = makeFakeDb();
    await listUpcomingMatches(db, { userId: USER_ID, from: new Date(), to: new Date() });
    const sql = query.mock.calls[0]?.[0] ?? "";
    expect(sql).not.toContain("scale");
    expect(sql).not.toContain("distance");
  });
});
