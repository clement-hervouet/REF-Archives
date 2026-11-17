import { describe, expect, it } from "vitest";
import {
  compensationFormSchema,
  newAddressSchema,
  oneWayDistanceSchema,
  type CompensationFormInput,
} from "./compensations";

const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const CLUB_A = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const CLUB_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02";
const ADDRESS_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";

const ADDRESS = {
  street: "Avenue du Sport",
  number: "2",
  postalCode: "62400",
  city: "Béthune",
  country: "",
};

function input(overrides: Partial<CompensationFormInput> = {}): CompensationFormInput {
  return {
    date: "2026-11-14",
    time: "19:00",
    divisionId: DIVISION_ID,
    team1: { kind: "existing", clubId: CLUB_A },
    team2: { kind: "existing", clubId: CLUB_B },
    venue: { kind: "team1" },
    scaleId: SCALE_ID,
    oneWayDistance: "23,5",
    travelShared: false,
    ...overrides,
  };
}

/** Chemins (premier segment) des erreurs, pour vérifier quel champ est signalé. */
function errorPaths(overrides: Partial<CompensationFormInput>): string[] {
  const result = compensationFormSchema.safeParse(input(overrides));
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => String(issue.path[0]));
}

describe("oneWayDistanceSchema", () => {
  it("convertit des km aller en mètres aller-retour", () => {
    expect(oneWayDistanceSchema.parse("23,5")).toBe(47_000);
    expect(oneWayDistanceSchema.parse("23.5")).toBe(47_000);
    expect(oneWayDistanceSchema.parse("12")).toBe(24_000);
    expect(oneWayDistanceSchema.parse("0,001")).toBe(2);
    expect(oneWayDistanceSchema.parse(" 0 ")).toBe(0);
  });

  it("accepte la borne de 2 000 km aller", () => {
    expect(oneWayDistanceSchema.parse("2000")).toBe(4_000_000);
  });

  it("refuse les distances invalides ou trop grandes", () => {
    for (const value of ["", "-5", "2000,001", "10000", "12 km", "1e3", ",5", "12,", "1,2345"]) {
      expect(oneWayDistanceSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("newAddressSchema", () => {
  it("transforme les champs facultatifs vides en null", () => {
    expect(newAddressSchema.parse({ ...ADDRESS, number: " " })).toEqual({
      street: "Avenue du Sport",
      number: null,
      postalCode: "62400",
      city: "Béthune",
      country: null,
    });
  });

  it("refuse une rue vide, un code postal invalide ou un caractère de contrôle", () => {
    expect(newAddressSchema.safeParse({ ...ADDRESS, street: "  " }).success).toBe(false);
    expect(newAddressSchema.safeParse({ ...ADDRESS, postalCode: "6" }).success).toBe(false);
    expect(newAddressSchema.safeParse({ ...ADDRESS, postalCode: "62<400" }).success).toBe(false);
    expect(newAddressSchema.safeParse({ ...ADDRESS, city: "Bé\tthune" }).success).toBe(false);
  });
});

describe("compensationFormSchema", () => {
  it("valide une indemnité simple et calcule l'instant UTC et la distance", () => {
    const parsed = compensationFormSchema.parse(input());
    expect(parsed.startsAt.toISOString()).toBe("2026-11-14T18:00:00.000Z");
    expect(parsed.distanceM).toBe(47_000);
    expect(parsed.venue).toEqual({ kind: "team1" });
    expect(parsed).not.toHaveProperty("date");
    expect(parsed).not.toHaveProperty("oneWayDistance");
  });

  it("doublé : distance facultative, vide = 0, saisie gardée", () => {
    expect(
      compensationFormSchema.parse(input({ travelShared: true, oneWayDistance: " " })),
    ).toMatchObject({
      distanceM: 0,
      travelShared: true,
    });
    expect(compensationFormSchema.parse(input({ travelShared: true })).distanceM).toBe(47_000);
  });

  it("refuse une distance vide hors doublé, ou invalide même sur un doublé", () => {
    expect(errorPaths({ oneWayDistance: "" })).toEqual(["oneWayDistance"]);
    expect(errorPaths({ travelShared: true, oneWayDistance: "abc" })).toEqual(["oneWayDistance"]);
  });

  it("accepte des clubs créés à la volée (nom et code postal) et une adresse d'exception nouvelle", () => {
    const parsed = compensationFormSchema.parse(
      input({
        team1: { kind: "new", name: "BC Béthune", postalCode: " 62400 " },
        team2: { kind: "new", name: "ES Arras", postalCode: "62000" },
        venue: { kind: "new", address: { ...ADDRESS, street: "Rue du Gymnase" } },
      }),
    );
    expect(parsed.team1).toEqual({ kind: "new", name: "BC Béthune", postalCode: "62400" });
    expect(parsed.venue.kind).toBe("new");
  });

  it("exige le code postal d'un nouveau club", () => {
    expect(errorPaths({ team1: { kind: "new", name: "BC Béthune", postalCode: "" } })).toEqual([
      "team1",
    ]);
  });

  it("accepte une adresse d'exception déjà connue", () => {
    expect(
      compensationFormSchema.safeParse(
        input({ venue: { kind: "existing", addressId: ADDRESS_ID } }),
      ).success,
    ).toBe(true);
  });

  it("refuse le même club pour les deux équipes", () => {
    expect(errorPaths({ team2: { kind: "existing", clubId: CLUB_A } })).toEqual(["team2"]);
  });

  it("signale une heure inexistante sur le champ time", () => {
    expect(errorPaths({ date: "2026-03-29", time: "02:30" })).toEqual(["time"]);
  });

  it("signale l'heure inexistante en même temps qu'une autre erreur", () => {
    expect(
      errorPaths({
        date: "2026-03-29",
        time: "02:30",
        team2: { kind: "existing", clubId: CLUB_A },
      }),
    ).toEqual(["team2", "time"]);
  });

  it("refuse une date hors bornes ou invalide", () => {
    expect(errorPaths({ date: "1999-12-31" })).toEqual(["date"]);
    expect(errorPaths({ date: "2026-02-30" })).toEqual(["date"]);
  });

  it("refuse une heure invalide", () => {
    expect(errorPaths({ time: "19h00" })).toEqual(["time"]);
  });

  it("refuse des identifiants qui ne sont pas des UUID", () => {
    expect(errorPaths({ scaleId: "1" })).toEqual(["scaleId"]);
    expect(errorPaths({ divisionId: "' OR 1=1" })).toEqual(["divisionId"]);
  });
});

describe("compensationFormSchema : organisme qui verse (bloc 10)", () => {
  it("vide ou absent : déduction automatique (null)", () => {
    expect(compensationFormSchema.parse(input()).payer).toBeNull();
    expect(compensationFormSchema.parse(input({ payer: "" })).payer).toBeNull();
  });

  it("garde une clé connue", () => {
    expect(compensationFormSchema.parse(input({ payer: "cd-35" })).payer).toBe("cd-35");
    expect(compensationFormSchema.parse(input({ payer: "ligue-bretagne" })).payer).toBe(
      "ligue-bretagne",
    );
    expect(compensationFormSchema.parse(input({ payer: "federation" })).payer).toBe("federation");
  });

  it("refuse une clé inconnue ou forgée, sur le champ payer", () => {
    for (const payer of ["cd-99", "ligue-atlantide", "lnb", "'; DROP TABLE x; --"]) {
      const result = compensationFormSchema.safeParse(input({ payer }));
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["payer"]);
    }
  });
});

describe("compensationFormSchema : tour de coupe (§15.4.6)", () => {
  it("vide ou absent : pas de tour (null)", () => {
    expect(compensationFormSchema.parse(input()).cupRound).toBeNull();
    expect(compensationFormSchema.parse(input({ cupRound: "" })).cupRound).toBeNull();
  });

  it("garde un tour connu", () => {
    expect(compensationFormSchema.parse(input({ cupRound: "R16" })).cupRound).toBe("R16");
    expect(compensationFormSchema.parse(input({ cupRound: "F" })).cupRound).toBe("F");
  });

  it("refuse un tour inconnu, sur le champ cupRound", () => {
    for (const cupRound of ["R128", "1/16", "finale"]) {
      const result = compensationFormSchema.safeParse({ ...input(), cupRound });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["cupRound"]);
    }
  });
});

describe("compensationFormSchema : plateau (§15.4.7)", () => {
  it("équipe 2 absente : null (club organisateur seul)", () => {
    expect(compensationFormSchema.parse(input({ team2: null })).team2).toBeNull();
  });

  it("nombre de matchs : vide = null, 1 à 10 accepté", () => {
    expect(compensationFormSchema.parse(input()).gameCount).toBeNull();
    expect(compensationFormSchema.parse(input({ gameCount: "3" })).gameCount).toBe(3);
    expect(compensationFormSchema.parse(input({ gameCount: "10" })).gameCount).toBe(10);
  });

  it("refuse un nombre de matchs impossible, sur le champ gameCount", () => {
    for (const gameCount of ["0", "11", "2,5", "-1", "abc"]) {
      expect(errorPaths({ gameCount })).toEqual(["gameCount"]);
    }
  });
});

describe("compensationFormSchema : montant par match d'un plateau (§15.4.7)", () => {
  it("vide ou absent : null ; en euros → centimes", () => {
    expect(compensationFormSchema.parse(input()).plateauGameCents).toBeNull();
    expect(compensationFormSchema.parse(input({ plateauGameAmount: "15" })).plateauGameCents).toBe(
      1500,
    );
    expect(
      compensationFormSchema.parse(input({ plateauGameAmount: "12,5" })).plateauGameCents,
    ).toBe(1250);
  });

  it("refuse un montant invalide, sur le champ plateauGameAmount", () => {
    for (const plateauGameAmount of ["-3", "12,555", "abc", "1000000"]) {
      expect(errorPaths({ plateauGameAmount })).toEqual(["plateauGameAmount"]);
    }
  });
});
