import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { isTimeOfDay, parisLocalToUtc, toParisTimeOfDay } from "./paris-time";

describe("isTimeOfDay", () => {
  it("accepte les heures HH:MM", () => {
    for (const value of ["00:00", "09:05", "19:30", "23:59"]) {
      expect(isTimeOfDay(value), value).toBe(true);
    }
  });

  it("refuse les formats invalides", () => {
    for (const value of ["", "24:00", "9:05", "19:60", "19h30", "19:30:00", " 19:30"]) {
      expect(isTimeOfDay(value), value).toBe(false);
    }
  });
});

describe("parisLocalToUtc", () => {
  it("convertit une heure d'hiver (UTC+1)", () => {
    expect(parisLocalToUtc("2026-11-14", "19:00").toISOString()).toBe("2026-11-14T18:00:00.000Z");
  });

  it("convertit une heure d'été (UTC+2)", () => {
    expect(parisLocalToUtc("2026-06-20", "20:30").toISOString()).toBe("2026-06-20T18:30:00.000Z");
  });

  it("gère minuit et le passage de jour en UTC", () => {
    expect(parisLocalToUtc("2027-01-01", "00:30").toISOString()).toBe("2026-12-31T23:30:00.000Z");
  });

  it("refuse une heure inexistante (passage à l'heure d'été, 29/03/2026)", () => {
    expect(() => parisLocalToUtc("2026-03-29", "02:30")).toThrow(ValidationError);
  });

  it("convertit les heures qui encadrent le passage à l'heure d'été", () => {
    expect(parisLocalToUtc("2026-03-29", "01:59").toISOString()).toBe("2026-03-29T00:59:00.000Z");
    expect(parisLocalToUtc("2026-03-29", "03:00").toISOString()).toBe("2026-03-29T01:00:00.000Z");
  });

  it("choisit la première occurrence d'une heure ambiguë (retour à l'heure d'hiver, 25/10/2026)", () => {
    expect(parisLocalToUtc("2026-10-25", "02:30").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("refuse une date ou une heure invalide", () => {
    expect(() => parisLocalToUtc("2026-02-30", "19:00")).toThrow(ValidationError);
    expect(() => parisLocalToUtc("2026-11-14", "25:00")).toThrow(ValidationError);
  });
});

describe("toParisTimeOfDay", () => {
  it("donne l'heure de Paris, été comme hiver", () => {
    expect(toParisTimeOfDay(new Date("2026-11-14T18:00:00Z"))).toBe("19:00");
    expect(toParisTimeOfDay(new Date("2026-06-20T18:30:00Z"))).toBe("20:30");
    expect(toParisTimeOfDay(new Date("2026-12-31T23:05:00Z"))).toBe("00:05");
  });

  it("est l'inverse de parisLocalToUtc", () => {
    expect(toParisTimeOfDay(parisLocalToUtc("2026-10-25", "02:30"))).toBe("02:30");
  });

  it("refuse une date invalide", () => {
    expect(() => toParisTimeOfDay(new Date("x"))).toThrow(ValidationError);
  });
});
