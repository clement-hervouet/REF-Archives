import { describe, expect, it } from "vitest";
import { formatRoundTripKm, oneWayKmInput, parseOneWayDistance } from "./distance";
import { ValidationError } from "./errors";
import { oneWayDistanceSchema } from "./schemas/compensations";

describe("oneWayKmInput", () => {
  it("donne la distance aller saisie à l'origine", () => {
    expect(oneWayKmInput(47_000)).toBe("23,5");
    expect(oneWayKmInput(24_000)).toBe("12");
    expect(oneWayKmInput(2)).toBe("0,001");
    expect(oneWayKmInput(0)).toBe("0");
  });

  it("est l'inverse exact de la saisie", () => {
    for (const value of ["23,5", "12", "0,125", "1999,999", "2000"]) {
      expect(oneWayKmInput(oneWayDistanceSchema.parse(value))).toBe(value);
    }
  });

  it("arrondit un aller-retour impair au mètre", () => {
    expect(oneWayKmInput(3)).toBe("0,002");
  });

  it("refuse une distance invalide", () => {
    expect(() => oneWayKmInput(-1)).toThrow(ValidationError);
    expect(() => oneWayKmInput(1.5)).toThrow(ValidationError);
  });
});

describe("formatRoundTripKm", () => {
  it("affiche l'aller-retour en km", () => {
    expect(formatRoundTripKm(47_000)).toBe("47 km");
    expect(formatRoundTripKm(46_500)).toBe("46,5 km");
  });
});

describe("parseOneWayDistance", () => {
  it("convertit les km aller en mètres aller-retour", () => {
    expect(parseOneWayDistance("23,5")).toBe(47_000);
    expect(parseOneWayDistance(" 12 ")).toBe(24_000);
    expect(parseOneWayDistance("0.001")).toBe(2);
    expect(parseOneWayDistance("2000")).toBe(4_000_000);
  });

  it("renvoie null pour une saisie invalide ou trop grande", () => {
    for (const value of ["", "abc", "-3", "1,2345", "2000,001", "12 km"]) {
      expect(parseOneWayDistance(value)).toBeNull();
    }
  });
});
