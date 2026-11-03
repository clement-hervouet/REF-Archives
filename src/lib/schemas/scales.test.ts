import { describe, expect, it } from "vitest";
import {
  addScaleRateFormSchema,
  createScaleFormSchema,
  effectiveFromSchema,
  gameAmountSchema,
  levelDefaultFormSchema,
  ratePerKmSchema,
  scaleNameSchema,
} from "./scales";

const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";

describe("gameAmountSchema", () => {
  it("convertit des euros en centimes, avec virgule ou point", () => {
    expect(gameAmountSchema.parse("45")).toBe(4500);
    expect(gameAmountSchema.parse("45,5")).toBe(4550);
    expect(gameAmountSchema.parse("45.05")).toBe(4505);
    expect(gameAmountSchema.parse(" 0,00 ")).toBe(0);
  });

  it("accepte la borne haute", () => {
    expect(gameAmountSchema.parse("99999,99")).toBe(9_999_999);
  });

  it("refuse les montants invalides", () => {
    for (const value of ["", "-1", "45,555", "100000", "45 €", "4 500", "1e3", ",5", "45,"]) {
      expect(gameAmountSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("ratePerKmSchema", () => {
  it("convertit des euros par km en centimes par km (numeric à deux décimales)", () => {
    expect(ratePerKmSchema.parse("0,40")).toBe("40.00");
    expect(ratePerKmSchema.parse("0.4")).toBe("40.00");
    expect(ratePerKmSchema.parse("0,425")).toBe("42.50");
    expect(ratePerKmSchema.parse("0,4257")).toBe("42.57");
    expect(ratePerKmSchema.parse("1")).toBe("100.00");
    expect(ratePerKmSchema.parse("0")).toBe("0.00");
  });

  it("accepte la borne de la colonne (9999,99 centimes par km)", () => {
    expect(ratePerKmSchema.parse("99,9999")).toBe("9999.99");
  });

  it("refuse les taux invalides", () => {
    for (const value of ["", "-0,40", "0,42575", "100", "0,40 €", "abc"]) {
      expect(ratePerKmSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("effectiveFromSchema", () => {
  it("accepte une date passée ou future dans les bornes", () => {
    expect(effectiveFromSchema.parse("2020-09-01")).toBe("2020-09-01");
    expect(effectiveFromSchema.parse("2030-01-01")).toBe("2030-01-01");
  });

  it("refuse une date inexistante, mal formée ou hors bornes", () => {
    for (const value of ["2026-02-30", "01/09/2026", "1999-12-31", "2101-01-01", ""]) {
      expect(effectiveFromSchema.safeParse(value).success, value).toBe(false);
    }
  });
});

describe("scaleNameSchema", () => {
  it("retire les espaces autour du nom", () => {
    expect(scaleNameSchema.parse("  Comité 62  ")).toBe("Comité 62");
  });

  it("refuse un nom vide, trop long ou sur plusieurs lignes", () => {
    for (const value of ["", "   ", "a".repeat(101), "Comité\n62", "Comité\t62"]) {
      expect(scaleNameSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
    }
  });
});

describe("formulaires", () => {
  it("valide la création d'un barème avec sa première ligne", () => {
    expect(
      createScaleFormSchema.parse({
        name: "Comité 62",
        effectiveFrom: "2026-09-01",
        gameAmount: "48",
        ratePerKm: "0,40",
      }),
    ).toEqual({
      name: "Comité 62",
      effectiveFrom: "2026-09-01",
      gameAmount: 4800,
      ratePerKm: "40.00",
    });
  });

  it("exige un identifiant de barème valide pour ajouter une ligne", () => {
    const fields = { effectiveFrom: "2026-09-01", gameAmount: "48", ratePerKm: "0,40" };
    expect(addScaleRateFormSchema.safeParse({ ...fields, scaleId: SCALE_ID }).success).toBe(true);
    expect(addScaleRateFormSchema.safeParse({ ...fields, scaleId: "42" }).success).toBe(false);
  });

  it("accepte une valeur vide pour revenir au barème commun", () => {
    expect(levelDefaultFormSchema.parse({ divisionId: DIVISION_ID, scaleId: "" })).toEqual({
      divisionId: DIVISION_ID,
      scaleId: "",
    });
    expect(
      levelDefaultFormSchema.safeParse({ divisionId: DIVISION_ID, scaleId: "x" }).success,
    ).toBe(false);
  });
});