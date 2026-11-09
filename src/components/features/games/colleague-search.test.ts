import { describe, expect, it } from "vitest";
import { colleagueSearchText, matchesSearch, normalizeSearch } from "./colleague-search";

describe("normalizeSearch", () => {
  it("retire accents, casse et espaces en trop", () => {
    expect(normalizeSearch("  Élodie   LE GOFF ")).toBe("elodie le goff");
  });
});

describe("matchesSearch", () => {
  const text = colleagueSearchText({
    firstname: "Élodie",
    lastname: "Le Goff",
    clubName: "BC Rennes",
  });

  it("trouve par nom, prénom ou club, sans accents", () => {
    expect(matchesSearch(text, "goff")).toBe(true);
    expect(matchesSearch(text, "elodie")).toBe(true);
    expect(matchesSearch(text, "RENNES")).toBe(true);
  });

  it("exige chaque mot, dans n'importe quel ordre", () => {
    expect(matchesSearch(text, "rennes élodie")).toBe(true);
    expect(matchesSearch(text, "rennes martin")).toBe(false);
  });

  it("une recherche vide garde tout", () => {
    expect(matchesSearch(text, "   ")).toBe(true);
  });

  it("collègue sans prénom ni club", () => {
    expect(colleagueSearchText({ firstname: null, lastname: "Martin", clubName: null })).toBe(
      "martin",
    );
  });
});
