import { describe, expect, it } from "vitest";
import { divisionLabel } from "./division-label";

describe("divisionLabel", () => {
  it("affiche les libellés français accentués", () => {
    expect(divisionLabel({ category: "Regional", type: "Feminin", level: "U15" })).toBe(
      "Régional Féminin U15",
    );
    expect(divisionLabel({ category: "Departemental", type: "Masculin", level: "1" })).toBe(
      "Départemental Masculin 1",
    );
  });
});