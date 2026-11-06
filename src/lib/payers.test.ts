import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  LEAGUES,
  deducePayer,
  departmentFromPostalCode,
  effectivePayer,
  parsePayerKey,
  payerKey,
  payerLabel,
  payerRank,
} from "./payers";

describe("référentiel", () => {
  it("compte 101 départements, sans doublon", () => {
    const codes = DEPARTMENTS.map((department) => department.code);
    expect(codes).toHaveLength(101);
    expect(new Set(codes).size).toBe(101);
  });

  it("rattache chaque département à exactement une ligue", () => {
    const covered = LEAGUES.flatMap((league) => league.departments);
    expect(covered).toHaveLength(101);
    expect(new Set(covered)).toEqual(new Set(DEPARTMENTS.map((department) => department.code)));
  });

  it("place la Bretagne et les Pays de la Loire comme attendu", () => {
    const bretagne = LEAGUES.find((league) => league.key === "bretagne");
    const pdl = LEAGUES.find((league) => league.key === "pays-de-la-loire");
    expect(bretagne?.departments).toEqual(["22", "29", "35", "56"]);
    expect(pdl?.departments).toEqual(["44", "49", "53", "72", "85"]);
  });
});

describe("departmentFromPostalCode", () => {
  it("prend les deux premiers chiffres en métropole", () => {
    expect(departmentFromPostalCode("35000", null)).toBe("35");
    expect(departmentFromPostalCode("01000", null)).toBe("01");
    expect(departmentFromPostalCode(" 62 400 ", "France")).toBe("62");
  });

  it("distingue la Corse-du-Sud et la Haute-Corse", () => {
    expect(departmentFromPostalCode("20000", null)).toBe("2A");
    expect(departmentFromPostalCode("20137", null)).toBe("2A");
    expect(departmentFromPostalCode("20200", null)).toBe("2B");
    expect(departmentFromPostalCode("20600", null)).toBe("2B");
  });

  it("prend trois chiffres en outre-mer", () => {
    expect(departmentFromPostalCode("97100", null)).toBe("971");
    expect(departmentFromPostalCode("97400", null)).toBe("974");
    expect(departmentFromPostalCode("97600", null)).toBe("976");
  });

  it("renvoie null pour l'étranger, un code inconnu ou mal formé", () => {
    expect(departmentFromPostalCode("1000", "Belgique")).toBeNull();
    expect(departmentFromPostalCode("35000", "Belgique")).toBeNull();
    expect(departmentFromPostalCode("00100", null)).toBeNull();
    expect(departmentFromPostalCode("97500", null)).toBeNull(); // Saint-Pierre-et-Miquelon
    expect(departmentFromPostalCode("98000", null)).toBeNull(); // Monaco
    expect(departmentFromPostalCode("SW1A 1AA", null)).toBeNull();
    expect(departmentFromPostalCode("3500", null)).toBeNull();
  });

  it("accepte les écritures courantes de la France", () => {
    for (const country of ["France", "FRANCE", " fr ", "FRA", ""]) {
      expect(departmentFromPostalCode("35000", country)).toBe("35");
    }
  });
});

describe("deducePayer", () => {
  it("départemental : comité du département", () => {
    expect(deducePayer("Departemental", "35")).toEqual({ kind: "committee", department: "35" });
  });

  it("régional : ligue de la région du département", () => {
    expect(deducePayer("Regional", "56")).toEqual({ kind: "league", league: "bretagne" });
    expect(deducePayer("Regional", "44")).toEqual({ kind: "league", league: "pays-de-la-loire" });
    expect(deducePayer("Regional", "2B")).toEqual({ kind: "league", league: "corse" });
  });

  it("national et pro : Fédération, même sans département", () => {
    expect(deducePayer("National", null)).toEqual({ kind: "federation" });
    expect(deducePayer("Pro", "75")).toEqual({ kind: "federation" });
  });

  it("inconnu sans département pour un match départemental ou régional", () => {
    expect(deducePayer("Departemental", null)).toBeNull();
    expect(deducePayer("Regional", null)).toBeNull();
  });
});

describe("clés et libellés", () => {
  it("fait l'aller-retour clé ↔ organisme", () => {
    for (const payer of [
      { kind: "committee", department: "2A" },
      { kind: "league", league: "ile-de-france" },
      { kind: "federation" },
    ] as const) {
      expect(parsePayerKey(payerKey(payer))).toEqual(payer);
    }
  });

  it("refuse une clé inconnue ou forgée", () => {
    for (const key of ["cd-20", "cd-99", "ligue-atlantide", "lnb", "", "cd-", "CD-35"]) {
      expect(parsePayerKey(key)).toBeNull();
    }
  });

  it("affiche CDxx, le nom de la ligue ou Fédération", () => {
    expect(payerLabel({ kind: "committee", department: "35" })).toBe("CD35");
    expect(payerLabel({ kind: "league", league: "pays-de-la-loire" })).toBe(
      "Ligue des Pays de la Loire",
    );
    expect(payerLabel({ kind: "federation" })).toBe("Fédération");
    expect(payerLabel(null)).toBe("Organisme inconnu");
  });

  it("classe comités, ligues, Fédération, inconnu", () => {
    expect(payerRank({ kind: "committee", department: "35" })).toBe(0);
    expect(payerRank({ kind: "league", league: "bretagne" })).toBe(1);
    expect(payerRank({ kind: "federation" })).toBe(2);
    expect(payerRank(null)).toBe(3);
  });
});

describe("effectivePayer", () => {
  const base = { category: "Regional", postalCode: "35000", country: null } as const;

  it("déduit l'organisme sans choix enregistré", () => {
    expect(effectivePayer({ ...base, override: null })).toEqual({
      kind: "league",
      league: "bretagne",
    });
  });

  it("garde le choix enregistré", () => {
    expect(effectivePayer({ ...base, override: "federation" })).toEqual({ kind: "federation" });
    expect(effectivePayer({ ...base, override: "cd-56" })).toEqual({
      kind: "committee",
      department: "56",
    });
  });

  it("revient à la déduction si le choix enregistré n'est plus valide", () => {
    expect(effectivePayer({ ...base, override: "ligue-disparue" })).toEqual({
      kind: "league",
      league: "bretagne",
    });
  });
});
