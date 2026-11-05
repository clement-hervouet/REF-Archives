import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { currentParisMonth, formatMonth, isMonth, nextMonth, parisMonthRange } from "./months";

describe("isMonth", () => {
  it("accepte AAAA-MM", () => {
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-01")).toBe(true);
  });

  it("refuse le reste", () => {
    for (const value of ["", "2026-13", "2026-00", "2026-1", "26-11", "2026-11-01", "2026/11"]) {
      expect(isMonth(value), value).toBe(false);
    }
  });
});

describe("currentParisMonth", () => {
  it("utilise le mois de Paris, pas celui d'UTC", () => {
    // 31/10/2026 23:30 UTC = 01/11/2026 00:30 à Paris.
    expect(currentParisMonth(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });
});

describe("nextMonth", () => {
  it("passe au mois suivant, y compris en fin d'année", () => {
    expect(nextMonth("2026-11")).toBe("2026-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });

  it("refuse un mois invalide", () => {
    expect(() => nextMonth("2026-13")).toThrow(ValidationError);
  });
});

describe("parisMonthRange", () => {
  it("donne les bornes UTC d'un mois d'hiver", () => {
    const range = parisMonthRange("2026-12");
    expect(range.from.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });

  it("suit le changement d'heure à l'intérieur du mois", () => {
    // Octobre 2026 : début en heure d'été (UTC+2), fin en heure d'hiver (UTC+1).
    const range = parisMonthRange("2026-10");
    expect(range.from.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });
});

describe("formatMonth", () => {
  it("écrit le mois en français", () => {
    expect(formatMonth("2026-11")).toBe("novembre 2026");
    expect(formatMonth("2027-02")).toBe("février 2027");
  });
});
