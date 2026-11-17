import { describe, expect, it } from "vitest";
import type { Division } from "@/server/db/divisions";
import type { MatchDivision } from "@/server/db/match-info";
import {
  divisionAbbreviation,
  divisionLabel,
  groupDivisions,
  matchLevelLabel,
} from "./division-label";

describe("divisionLabel", () => {
  it("affiche les libellés français accentués", () => {
    expect(divisionLabel({ category: "Regional", type: "Feminin", level: "U15", cup: false })).toBe(
      "Régional Féminin U15",
    );
    expect(
      divisionLabel({ category: "Departemental", type: "Masculin", level: "1", cup: false }),
    ).toBe("Départemental Masculin 1");
  });
});

describe("divisionAbbreviation", () => {
  it("colle catégorie, sexe et niveau", () => {
    expect(
      divisionAbbreviation({ category: "Departemental", type: "Masculin", level: "2", cup: false }),
    ).toBe("DM2");
    expect(
      divisionAbbreviation({ category: "Regional", type: "Feminin", level: "U15", cup: false }),
    ).toBe("RFU15");
    expect(
      divisionAbbreviation({ category: "National", type: "Masculin", level: "3", cup: false }),
    ).toBe("NM3");
    expect(
      divisionAbbreviation({ category: "National", type: "Feminin", level: "U21", cup: false }),
    ).toBe("NFU21");
  });

  it("nomme le plus haut niveau départemental et régional", () => {
    expect(
      divisionAbbreviation({ category: "Departemental", type: "Masculin", level: "1", cup: false }),
    ).toBe("PRM");
    expect(
      divisionAbbreviation({ category: "Departemental", type: "Feminin", level: "1", cup: false }),
    ).toBe("PRF");
    expect(
      divisionAbbreviation({ category: "Regional", type: "Masculin", level: "1", cup: false }),
    ).toBe("PNM");
    expect(
      divisionAbbreviation({ category: "Regional", type: "Feminin", level: "1", cup: false }),
    ).toBe("PNF");
  });

  it("garde le code pour les jeunes et les autres niveaux", () => {
    expect(
      divisionAbbreviation({ category: "Regional", type: "Masculin", level: "U18", cup: false }),
    ).toBe("RMU18");
    expect(
      divisionAbbreviation({ category: "National", type: "Masculin", level: "1", cup: false }),
    ).toBe("NM1");
  });

  it("garde les noms d'usage du Pro", () => {
    expect(
      divisionAbbreviation({ category: "Pro", type: "Masculin", level: "1", cup: false }),
    ).toBe("Pro A");
    expect(
      divisionAbbreviation({ category: "Pro", type: "Masculin", level: "2", cup: false }),
    ).toBe("Pro B");
    expect(divisionAbbreviation({ category: "Pro", type: "Feminin", level: "1", cup: false })).toBe(
      "LFB",
    );
    expect(divisionAbbreviation({ category: "Pro", type: "Feminin", level: "2", cup: false })).toBe(
      "LF2",
    );
  });

  it("retombe sur le code pour un niveau Pro sans nom", () => {
    expect(
      divisionAbbreviation({ category: "Pro", type: "Masculin", level: "3", cup: false }),
    ).toBe("PM3");
  });
});

describe("coupes (§15.4.6)", () => {
  const seniorsDep = {
    category: "Departemental",
    type: "Masculin",
    level: "Seniors",
    cup: true,
  } as const;
  const u18Reg = { category: "Regional", type: "Feminin", level: "U18", cup: true } as const;
  const u18Nat = { category: "National", type: "Feminin", level: "U18", cup: true } as const;

  function match(
    division: Pick<MatchDivision, "category" | "type" | "level" | "cup">,
    extra: Partial<MatchDivision>,
  ): MatchDivision {
    return { ...division, cupRound: null, department: null, ...extra };
  }

  it("libellé complet sans match", () => {
    expect(divisionLabel(seniorsDep)).toBe("Coupe départementale Seniors Masculin");
    expect(divisionLabel(u18Reg)).toBe("Coupe régionale U18 Féminin");
    expect(divisionLabel(u18Nat)).toBe("Coupe de France U18 Féminin");
  });

  it("nomme la coupe d'après le département du match", () => {
    expect(divisionAbbreviation(seniorsDep, "56")).toBe("COUPE 56 SM");
    expect(divisionAbbreviation(u18Reg, "56")).toBe("CBU18F");
    expect(divisionAbbreviation(u18Reg, "75")).toBe("CIDFU18F");
    expect(divisionAbbreviation(u18Nat, "56")).toBe("CDF U18F");
  });

  it("garde un nom générique tant que le lieu est inconnu", () => {
    expect(divisionAbbreviation(seniorsDep)).toBe("COUPE DÉP. SM");
    expect(divisionAbbreviation(u18Reg)).toBe("COUPE RÉG. U18F");
    expect(divisionAbbreviation(u18Nat)).toBe("CDF U18F");
  });

  it("ajoute le tour au niveau d'un match de coupe", () => {
    expect(matchLevelLabel(match(u18Reg, { cupRound: "R16", department: "29" }))).toBe(
      "CBU18F (1/16)",
    );
    expect(matchLevelLabel(match(seniorsDep, { cupRound: "R2", department: "56" }))).toBe(
      "COUPE 56 SM 1/2",
    );
    expect(matchLevelLabel(match(u18Nat, { cupRound: "F" }))).toBe("CDF U18F Finale");
  });

  it("garde le libellé complet d'un championnat", () => {
    expect(
      matchLevelLabel(
        match({ category: "Regional", type: "Feminin", level: "U15", cup: false }, {}),
      ),
    ).toBe("Régional Féminin U15");
  });

  it("regroupe les coupes après les championnats", () => {
    const divisions: Division[] = [
      { id: "a", category: "Departemental", type: "Masculin", level: "1", cup: false },
      { id: "b", category: "Regional", type: "Masculin", level: "1", cup: false },
      { id: "c", ...seniorsDep },
      { id: "d", ...u18Reg },
      { id: "e", ...u18Nat },
    ];
    expect(groupDivisions(divisions).map((group) => [group.label, group.divisions.length])).toEqual(
      [
        ["Départemental", 1],
        ["Régional", 1],
        ["Coupes départementales", 1],
        ["Coupes régionales", 1],
        ["Coupe de France", 1],
      ],
    );
  });
});
