import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { assertIsoDate, isIsoDate, toParisIsoDate } from "./dates";

describe("isIsoDate", () => {
  it("accepte une date AAAA-MM-JJ existante", () => {
    expect(isIsoDate("2026-11-03")).toBe(true);
  });

  it("accepte le 29 février d'une année bissextile", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("refuse le 29 février d'une année non bissextile", () => {
    expect(isIsoDate("2027-02-29")).toBe(false);
  });

  it("refuse un jour qui n'existe pas", () => {
    expect(isIsoDate("2026-04-31")).toBe(false);
  });

  it("refuse les autres formats", () => {
    expect(isIsoDate("03/11/2026")).toBe(false);
    expect(isIsoDate("2026-11-3")).toBe(false);
    expect(isIsoDate("2026-11-03T00:00:00Z")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("assertIsoDate", () => {
  it("lève une ValidationError sur une date invalide", () => {
    expect(() => {
      assertIsoDate("2026-13-01");
    }).toThrow(ValidationError);
  });

  it("ne lève rien sur une date valide", () => {
    expect(() => {
      assertIsoDate("2026-01-01");
    }).not.toThrow();
  });
});

describe("toParisIsoDate", () => {
  it("garde le même jour en journée", () => {
    expect(toParisIsoDate(new Date("2026-11-14T18:00:00.000Z"))).toBe("2026-11-14");
  });

  it("passe au lendemain quand il est déjà minuit à Paris (hiver, UTC+1)", () => {
    expect(toParisIsoDate(new Date("2026-12-31T23:30:00.000Z"))).toBe("2027-01-01");
  });

  it("passe au lendemain dès 22h UTC en été (UTC+2)", () => {
    expect(toParisIsoDate(new Date("2026-08-31T22:00:00.000Z"))).toBe("2026-09-01");
  });

  it("reste la veille juste avant minuit à Paris", () => {
    expect(toParisIsoDate(new Date("2026-08-31T21:59:59.999Z"))).toBe("2026-08-31");
  });

  it("lève une ValidationError sur une date invalide", () => {
    expect(() => toParisIsoDate(new Date("invalide"))).toThrow(ValidationError);
  });
});