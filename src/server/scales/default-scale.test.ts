import { describe, expect, it } from "vitest";
import { resolveDefaultScaleId } from "./default-scale";

const COMMON = "commun";
const levelDefaults = [
  { divisionId: "regional-m1", scaleId: "comite" },
  { divisionId: "national-m3", scaleId: "tournoi" },
];

describe("resolveDefaultScaleId", () => {
  it("prend le barème associé au niveau du match", () => {
    expect(
      resolveDefaultScaleId({
        divisionId: "regional-m1",
        levelDefaults,
        commonScaleId: COMMON,
        selectableScaleIds: new Set([COMMON, "comite", "tournoi"]),
      }),
    ).toBe("comite");
  });

  it("distingue deux niveaux associés à deux barèmes différents", () => {
    expect(
      resolveDefaultScaleId({
        divisionId: "national-m3",
        levelDefaults,
        commonScaleId: COMMON,
        selectableScaleIds: new Set([COMMON, "comite", "tournoi"]),
      }),
    ).toBe("tournoi");
  });

  it("revient au barème commun pour un niveau sans défaut", () => {
    expect(
      resolveDefaultScaleId({
        divisionId: "departemental-f2",
        levelDefaults,
        commonScaleId: COMMON,
        selectableScaleIds: new Set([COMMON, "comite", "tournoi"]),
      }),
    ).toBe(COMMON);
  });

  it("revient au barème commun quand l'utilisateur n'a aucun défaut", () => {
    expect(
      resolveDefaultScaleId({
        divisionId: "regional-m1",
        levelDefaults: [],
        commonScaleId: COMMON,
        selectableScaleIds: new Set([COMMON]),
      }),
    ).toBe(COMMON);
  });

  it("ignore un défaut qui pointe vers un barème qui n'est plus sélectionnable", () => {
    expect(
      resolveDefaultScaleId({
        divisionId: "regional-m1",
        levelDefaults,
        commonScaleId: COMMON,
        selectableScaleIds: new Set([COMMON, "tournoi"]),
      }),
    ).toBe(COMMON);
  });
});
