import { describe, expect, it } from "vitest";
import { gameNotesSearch, parseGameNotesFilters } from "./game-notes-filters";

const CLUB_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";

describe("parseGameNotesFilters", () => {
  it("lit des filtres valides", () => {
    expect(
      parseGameNotesFilters({
        categorie: "Regional",
        niveau: "U15",
        type: "Feminin",
        club: CLUB_ID,
        page: "3",
      }),
    ).toEqual({ category: "Regional", level: "U15", type: "Feminin", clubId: CLUB_ID, page: 3 });
  });

  it("sans paramètre : aucun filtre, page 1", () => {
    expect(parseGameNotesFilters({})).toEqual({
      category: null,
      level: null,
      type: null,
      clubId: null,
      page: 1,
    });
  });

  it("ignore les valeurs invalides ou répétées", () => {
    expect(
      parseGameNotesFilters({
        categorie: "regional",
        niveau: "u15",
        type: ["Masculin", "Feminin"],
        club: "1 OR 1=1",
        page: "0",
      }),
    ).toEqual({ category: null, level: null, type: null, clubId: null, page: 1 });
    for (const page of ["-1", "1.5", "abc", "01", "1001", "99999"]) {
      expect(parseGameNotesFilters({ page }).page).toBe(1);
    }
  });

  it("accepte la dernière page autorisée", () => {
    expect(parseGameNotesFilters({ page: "1000" }).page).toBe(1000);
  });
});

describe("gameNotesSearch", () => {
  it("reconstruit l'URL des filtres actifs", () => {
    expect(
      gameNotesSearch({
        category: "National",
        level: "1",
        type: "Masculin",
        clubId: CLUB_ID,
        page: 2,
      }),
    ).toBe(`?categorie=National&niveau=1&type=Masculin&club=${CLUB_ID}&page=2`);
  });

  it("omet les filtres vides et la page 1", () => {
    expect(
      gameNotesSearch({ category: null, level: null, type: null, clubId: null, page: 1 }),
    ).toBe("");
  });
});
