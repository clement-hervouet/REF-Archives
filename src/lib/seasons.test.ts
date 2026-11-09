import { describe, expect, it } from "vitest";
import { seasonLabel, seasonOf, seasonRange } from "./seasons";

describe("seasonOf", () => {
  it("rattache juillet à décembre à la saison qui commence cette année", () => {
    expect(seasonOf("2026-07")).toBe(2026);
    expect(seasonOf("2026-11")).toBe(2026);
    expect(seasonOf("2026-12")).toBe(2026);
  });

  it("rattache janvier à juin à la saison commencée l'année d'avant", () => {
    expect(seasonOf("2027-01")).toBe(2026);
    expect(seasonOf("2027-06")).toBe(2026);
  });

  it("refuse un mois mal formé", () => {
    expect(() => seasonOf("2026-13")).toThrow();
    expect(() => seasonOf("2026")).toThrow();
  });
});

describe("seasonLabel", () => {
  it("affiche les deux années", () => {
    expect(seasonLabel(2026)).toBe("2026-2027");
  });
});

describe("seasonRange", () => {
  it("va du 1er juillet minuit à Paris au 1er juillet suivant (exclu)", () => {
    // Juillet : heure d'été, Paris = UTC+2.
    expect(seasonRange(2026)).toEqual({
      from: new Date("2026-06-30T22:00:00Z"),
      to: new Date("2027-06-30T22:00:00Z"),
    });
  });
});
