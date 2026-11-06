import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import {
  addDays,
  daysBetween,
  formatShortDate,
  isoWeekday,
  mondayOf,
  parisWeekendRange,
  saturdayOf,
} from "./weeks";

describe("addDays", () => {
  it("avance et recule d'un nombre de jours", () => {
    expect(addDays("2026-11-05", 1)).toBe("2026-11-06");
    expect(addDays("2026-11-05", -5)).toBe("2026-10-31");
    expect(addDays("2026-11-05", 0)).toBe("2026-11-05");
  });

  it("traverse les fins de mois, d'année et le 29 février", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("ignore les changements d'heure (dates sans heure)", () => {
    // Passage à l'heure d'hiver le 25/10/2026, à l'heure d'été le 28/03/2027.
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2027-03-27", 2)).toBe("2027-03-29");
  });

  it("refuse une date invalide ou un décalage non entier", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(ValidationError);
    expect(() => addDays("2026-11-05", 1.5)).toThrow(ValidationError);
  });
});

describe("isoWeekday", () => {
  it("numérote du lundi (1) au dimanche (7)", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-05")).toBe(4);
    expect(isoWeekday("2026-11-07")).toBe(6);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });
});

describe("mondayOf / saturdayOf", () => {
  it("ramène au lundi et au samedi de la même semaine", () => {
    expect(mondayOf("2026-11-05")).toBe("2026-11-02");
    expect(saturdayOf("2026-11-05")).toBe("2026-11-07");
  });

  it("rattache le dimanche à la semaine qui se termine", () => {
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(saturdayOf("2026-11-08")).toBe("2026-11-07");
  });

  it("garde le lundi tel quel, y compris en changeant d'année", () => {
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
    expect(saturdayOf("2026-12-28")).toBe("2027-01-02");
  });
});

describe("parisWeekendRange", () => {
  it("va du vendredi 00:00 au lundi 00:00 à Paris (heure d'hiver)", () => {
    expect(parisWeekendRange("2026-11-07")).toEqual({
      from: new Date("2026-11-05T23:00:00.000Z"),
      to: new Date("2026-11-08T23:00:00.000Z"),
    });
  });

  it("suit le changement d'heure pendant le weekend", () => {
    // Passage à l'heure d'hiver dans la nuit du samedi 24 au dimanche 25/10/2026.
    expect(parisWeekendRange("2026-10-24")).toEqual({
      from: new Date("2026-10-22T22:00:00.000Z"),
      to: new Date("2026-10-25T23:00:00.000Z"),
    });
  });

  it("refuse une date qui n'est pas un samedi", () => {
    expect(() => parisWeekendRange("2026-11-08")).toThrow(ValidationError);
  });
});

describe("formatShortDate", () => {
  it("affiche jour et mois sur deux chiffres", () => {
    expect(formatShortDate("2026-12-05")).toBe("05/12");
  });
});

describe("daysBetween", () => {
  it("compte les jours calendaires, y compris en traversant un mois ou une année", () => {
    expect(daysBetween("2026-11-06", "2026-11-06")).toBe(0);
    expect(daysBetween("2026-11-06", "2026-11-08")).toBe(2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-11-08", "2026-11-06")).toBe(-2);
  });

  it("ignore les changements d'heure (dates sans heure)", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
  });
});
