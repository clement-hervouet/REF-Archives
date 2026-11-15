import { describe, expect, it } from "vitest";
import { divisionAbbreviation, divisionLabel } from "./division-label";

describe("divisionLabel", () => {
  it("affiche les libellés français accentués", () => {
    expect(divisionLabel({ category: "Regional", type: "Feminin", level: "U15" })).toBe(
      "Régional Féminin U15",
    );
    expect(divisionLabel({ category: "Departemental", type: "Masculin", level: "1" })).toBe(
      "Départemental Masculin 1",
    );
  });
});

describe("divisionAbbreviation", () => {
  it("colle catégorie, sexe et niveau", () => {
    expect(divisionAbbreviation({ category: "Departemental", type: "Masculin", level: "2" })).toBe(
      "DM2",
    );
    expect(divisionAbbreviation({ category: "Regional", type: "Feminin", level: "U15" })).toBe(
      "RFU15",
    );
    expect(divisionAbbreviation({ category: "National", type: "Masculin", level: "3" })).toBe(
      "NM3",
    );
    expect(divisionAbbreviation({ category: "National", type: "Feminin", level: "U21" })).toBe(
      "NFU21",
    );
  });

  it("nomme le plus haut niveau départemental et régional", () => {
    expect(divisionAbbreviation({ category: "Departemental", type: "Masculin", level: "1" })).toBe(
      "PRM",
    );
    expect(divisionAbbreviation({ category: "Departemental", type: "Feminin", level: "1" })).toBe(
      "PRF",
    );
    expect(divisionAbbreviation({ category: "Regional", type: "Masculin", level: "1" })).toBe(
      "PNM",
    );
    expect(divisionAbbreviation({ category: "Regional", type: "Feminin", level: "1" })).toBe("PNF");
  });

  it("garde le code pour les jeunes et les autres niveaux", () => {
    expect(divisionAbbreviation({ category: "Regional", type: "Masculin", level: "U18" })).toBe(
      "RMU18",
    );
    expect(divisionAbbreviation({ category: "National", type: "Masculin", level: "1" })).toBe(
      "NM1",
    );
  });

  it("garde les noms d'usage du Pro", () => {
    expect(divisionAbbreviation({ category: "Pro", type: "Masculin", level: "1" })).toBe("Pro A");
    expect(divisionAbbreviation({ category: "Pro", type: "Masculin", level: "2" })).toBe("Pro B");
    expect(divisionAbbreviation({ category: "Pro", type: "Feminin", level: "1" })).toBe("LFB");
    expect(divisionAbbreviation({ category: "Pro", type: "Feminin", level: "2" })).toBe("LF2");
  });

  it("retombe sur le code pour un niveau Pro sans nom", () => {
    expect(divisionAbbreviation({ category: "Pro", type: "Masculin", level: "3" })).toBe("PM3");
  });
});
