import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { computeCompensation, computeMileageCents, parseCentsPerKm } from "./amount";

describe("parseCentsPerKm", () => {
  it("lit un taux à deux décimales", () => {
    expect(parseCentsPerKm("40.00")).toBe(4000);
    expect(parseCentsPerKm("42.50")).toBe(4250);
  });

  it("complète une seule décimale (pg peut renvoyer « 42.5 »)", () => {
    expect(parseCentsPerKm("42.5")).toBe(4250);
  });

  it("lit un taux entier", () => {
    expect(parseCentsPerKm("40")).toBe(4000);
  });

  it("accepte zéro et la borne de la colonne numeric(6, 2)", () => {
    expect(parseCentsPerKm("0.00")).toBe(0);
    expect(parseCentsPerKm("9999.99")).toBe(999_999);
  });

  it("refuse les formats invalides", () => {
    for (const value of ["", "-1", "40,00", "40.001", "10000", "abc", " 40", "1e2"]) {
      expect(() => parseCentsPerKm(value), value).toThrow(ValidationError);
    }
  });
});

describe("computeMileageCents", () => {
  it("calcule 46 km à 0,40 €/km", () => {
    expect(computeMileageCents(46_000, "40.00")).toBe(1840);
  });

  it("calcule une distance au mètre près", () => {
    // 12,345 km × 40 c/km = 493,8 c → 494 c
    expect(computeMileageCents(12_345, "40.00")).toBe(494);
  });

  it("arrondit vers le bas sous le demi-centime", () => {
    // 1,011 km × 0,40 c/km = 0,4044 c → 0 c
    expect(computeMileageCents(1011, "0.40")).toBe(0);
  });

  it("arrondit le demi-centime vers le haut", () => {
    // 0,5 km × 41,00 c/km = 20,5 c → 21 c
    expect(computeMileageCents(500, "41.00")).toBe(21);
  });

  it("gère un taux à trois chiffres significatifs (0,425 €/km)", () => {
    // 46 km × 42,50 c/km = 1955 c
    expect(computeMileageCents(46_000, "42.50")).toBe(1955);
  });

  it("vaut zéro sans déplacement", () => {
    expect(computeMileageCents(0, "40.00")).toBe(0);
  });

  it("reste exact aux bornes (distance integer max, taux max)", () => {
    // 2 147 483 647 m × 999 999 / 100 000 = 21 474 814 994,98… → 21 474 814 995
    expect(computeMileageCents(2_147_483_647, "9999.99")).toBe(21_474_814_995);
  });

  it("refuse une distance négative, décimale ou hors bornes", () => {
    for (const distance of [-1, 1.5, Number.NaN, 2_147_483_648]) {
      expect(() => computeMileageCents(distance, "40.00"), String(distance)).toThrow(
        ValidationError,
      );
    }
  });
});

describe("computeCompensation", () => {
  it("additionne le match et le kilométrage", () => {
    expect(computeCompensation({ gameAmountCents: 4800, centsPerKm: "42.50" }, 46_000)).toEqual({
      gameCents: 4800,
      mileageCents: 1955,
      totalCents: 6755,
    });
  });

  it("accepte un match sans indemnité de match", () => {
    expect(computeCompensation({ gameAmountCents: 0, centsPerKm: "40.00" }, 10_000)).toEqual({
      gameCents: 0,
      mileageCents: 400,
      totalCents: 400,
    });
  });

  it("refuse un montant de match négatif ou non entier", () => {
    for (const gameAmountCents of [-1, 10.5]) {
      expect(
        () => computeCompensation({ gameAmountCents, centsPerKm: "40.00" }, 0),
        String(gameAmountCents),
      ).toThrow(ValidationError);
    }
  });
});
