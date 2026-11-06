import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  GAME_NOTES_PAGE_SIZE,
  NOTE_EXCERPT_LENGTH,
  averageNoteLevels,
  listGamesWithNotes,
} from "./game-notes";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const CLUB_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";

const NO_FILTERS = {
  category: null,
  level: null,
  type: null,
  clubId: null,
  includeWithoutNote: false,
  page: 1,
};

function row(index: number) {
  return {
    id: GAME_ID,
    starts_at: new Date(Date.UTC(2026, 10, 14 - index, 18)),
    division: "Regional",
    type: "Masculin",
    level: "1",
    team1_name: "Club Alpha",
    team2_name: "Club Beta",
    self_slot: "referee2",
    confidence: 4,
    stress: null,
    management: 2,
    judgment: null,
    excerpt: "Bon placement",
    excerpt_truncated: false,
    clip_count: 2,
    has_note: true,
  };
}

describe("listGamesWithNotes", () => {
  it("structure chaque ligne et passe les filtres en paramètres liés", async () => {
    const { db, query } = makeFakeDb([row(0)]);
    const page = await listGamesWithNotes(db, {
      userId: USER_ID,
      filters: {
        category: "Regional",
        level: "U15",
        type: "Feminin",
        clubId: CLUB_ID,
        includeWithoutNote: true,
        page: 3,
      },
    });
    expect(page).toEqual({
      hasMore: false,
      items: [
        {
          gameId: GAME_ID,
          startsAt: new Date("2026-11-14T18:00:00Z"),
          division: { category: "Regional", type: "Masculin", level: "1" },
          team1Name: "Club Alpha",
          team2Name: "Club Beta",
          selfSlot: "referee2",
          confidence: 4,
          stress: null,
          management: 2,
          judgment: null,
          excerpt: "Bon placement",
          excerptTruncated: false,
          clipCount: 2,
          hasNote: true,
        },
      ],
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      "Regional",
      "Feminin",
      CLUB_ID,
      GAME_NOTES_PAGE_SIZE + 1,
      2 * GAME_NOTES_PAGE_SIZE,
      NOTE_EXCERPT_LENGTH,
      "U15",
      true,
    ]);
    expect(query.mock.calls[0]?.[0]).toContain("n.deleted_at IS NULL");
  });

  it("sans filtre, passe des NULL et commence à la première ligne", async () => {
    const { db, query } = makeFakeDb();
    expect(await listGamesWithNotes(db, { userId: USER_ID, filters: NO_FILTERS })).toEqual({
      hasMore: false,
      items: [],
    });
    expect(query.mock.calls[0]?.[1]?.[7]).toBeNull();
    expect(query.mock.calls[0]?.[1]?.[8]).toBe(false);
    expect(query.mock.calls[0]?.[1]?.slice(1, 6)).toEqual([
      null,
      null,
      null,
      GAME_NOTES_PAGE_SIZE + 1,
      0,
    ]);
  });

  it("détecte une page suivante grâce à la ligne en trop", async () => {
    const rows = Array.from({ length: GAME_NOTES_PAGE_SIZE + 1 }, (_, index) => row(index));
    const { db } = makeFakeDb(rows);
    const page = await listGamesWithNotes(db, { userId: USER_ID, filters: NO_FILTERS });
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(GAME_NOTES_PAGE_SIZE);
  });
});

describe("averageNoteLevels", () => {
  it("renvoie moyenne et nombre par échelle, filtres en paramètres liés", async () => {
    const { db, query } = makeFakeDb([
      {
        confidence_avg: 3.75,
        confidence_count: 4,
        stress_avg: 2,
        stress_count: 1,
        management_avg: null,
        management_count: 0,
        judgment_avg: 4.5,
        judgment_count: 2,
      },
    ]);
    expect(
      await averageNoteLevels(db, {
        userId: USER_ID,
        filters: { ...NO_FILTERS, category: "Regional", clubId: CLUB_ID, level: "U15", page: 4 },
      }),
    ).toEqual({
      confidence: { average: 3.75, count: 4 },
      stress: { average: 2, count: 1 },
      management: { average: null, count: 0 },
      judgment: { average: 4.5, count: 2 },
    });
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, "Regional", null, CLUB_ID, "U15"]);
    expect(query.mock.calls[0]?.[0]).toContain("n.deleted_at IS NULL");
    expect(query.mock.calls[0]?.[0]).toContain("g.deleted_at IS NULL");
  });
});
