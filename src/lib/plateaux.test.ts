import { describe, expect, it } from "vitest";
import { isPlateauPeriod } from "./plateaux";

describe("isPlateauPeriod (§15.4.7)", () => {
  it("vrai du 1er juillet au 31 octobre", () => {
    expect(isPlateauPeriod("2026-07-01")).toBe(true);
    expect(isPlateauPeriod("2026-09-20")).toBe(true);
    expect(isPlateauPeriod("2026-10-31")).toBe(true);
  });

  it("faux le reste de l'année ou pour une date invalide", () => {
    expect(isPlateauPeriod("2026-06-30")).toBe(false);
    expect(isPlateauPeriod("2026-11-01")).toBe(false);
    expect(isPlateauPeriod("")).toBe(false);
    expect(isPlateauPeriod("2026-13-01")).toBe(false);
  });
});
