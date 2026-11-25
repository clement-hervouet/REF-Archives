import { describe, expect, it } from "vitest";
import { headingLevelOf, nextTextSize } from "./sizes";

describe("nextTextSize", () => {
  it("avance d'un cran dans l'échelle", () => {
    expect(nextTextSize("normal", 1)).toBe("h3");
    expect(nextTextSize("h3", 1)).toBe("h2");
    expect(nextTextSize("normal", -1)).toBe("small");
  });

  it("s'arrête aux deux bouts", () => {
    expect(nextTextSize("h1", 1)).toBeNull();
    expect(nextTextSize("small", -1)).toBeNull();
  });
});

describe("headingLevelOf", () => {
  it("associe les tailles aux niveaux de titre", () => {
    expect(headingLevelOf("h1")).toBe(1);
    expect(headingLevelOf("h3")).toBe(3);
    expect(headingLevelOf("normal")).toBeNull();
    expect(headingLevelOf("small")).toBeNull();
  });
});
