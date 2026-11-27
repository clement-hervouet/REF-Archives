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
  cup: false,
  plateau: false,
  cup_round: null,
  cup_postal_code: null,
  cup_country: null,
  team1_name: "BC Béthune",
  team2_name: "ES Lens",
  team1_club_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4cc1",
  team1_color: "#263a5d",
  team1_logo_uuid: "02175814-01ac-441c-a86a-2f4a9b80b1e0",
  team2_club_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4cc2",
  team2_color: null,
  team2_logo_uuid: null,
  street: "Rue du Stade",
  number: "2",
  postal_code: "62400",
  city: "Béthune",
  has_preparation: false,
};

describe("listUpcomingMatches", () => {
  it("renvoie les matchs de la période avec leurs officiels dans l'ordre", async () => {
    const from = new Date("2026-11-05T23:00:00Z");
    const to = new Date("2026-11-08T23:00:00Z");
    const { db, query } = makeFakeDb([
      {
        ...BASE_ROW,
        game_id: GAME_ID,
        has_preparation: true,
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
        division: {
          category: "Regional",
          type: "Feminin",
          level: "U15",
          cup: false,
          plateau: false,
          cupRound: null,
          department: null,
        },
        team1Name: "BC Béthune",
        team2Name: "ES Lens",
        team1Club: {
          id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4cc1",
          name: "BC Béthune",
          color: "#263a5d",
          logoUuid: "02175814-01ac-441c-a86a-2f4a9b80b1e0",
        },
        team2Club: {
          id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4cc2",
          name: "ES Lens",
          color: null,
          logoUuid: null,
        },
        address: { street: "Rue du Stade", number: "2", postalCode: "62400", city: "Béthune" },
        gameId: GAME_ID,
        officials: [
          { slot: "referee1", isSelf: false, firstname: "Alex", lastname: "Martin" },
          { slot: "referee2", isSelf: true, firstname: null, lastname: null },
        ],
        hasPreparation: true,
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
    expect(match?.hasPreparation).toBe(false);
  });

  it("ne lit aucun montant ni barème", async () => {
    const { db, query } = makeFakeDb();
    await listUpcomingMatches(db, { userId: USER_ID, from: new Date(), to: new Date() });
    const sql = query.mock.calls[0]?.[0] ?? "";
    expect(sql).not.toContain("scale");
    expect(sql).not.toContain("distance");
  });
});
