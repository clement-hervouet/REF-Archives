import { describe, expect, it } from "vitest";
import { isSameCity, normalizePlace } from "./places";

describe("normalizePlace", () => {
  it("retire accents et ponctuation, développe st et ste", () => {
    expect(normalizePlace("  Bédée ")).toBe("bedee");
    expect(normalizePlace("St-Grégoire")).toBe("saint gregoire");
    expect(normalizePlace("STE FOY-LÈS-LYON")).toBe("sainte foy les lyon");
  });
});

describe("isSameCity", () => {
  it("compare deux villes sans tenir compte de la casse, des accents ni des abréviations", () => {
    expect(isSameCity("RENNES", "Rennes")).toBe(true);
    expect(isSameCity("ST GREGOIRE", "Saint-Grégoire")).toBe(true);
    expect(isSameCity("Saint-Avé", "Rennes")).toBe(false);
  });

  it("accepte tout sans ville de référence, rien sans ville", () => {
    expect(isSameCity("Rennes", null)).toBe(true);
    expect(isSameCity(null, "Rennes")).toBe(false);
  });
});
