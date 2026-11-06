import { describe, expect, it } from "vitest";
import { levelTone } from "./level-tone";

describe("levelTone", () => {
  it("confiance : faible en rouge, moyenne en jaune, haute en vert", () => {
    expect([1, 2, 3, 4, 5].map((value) => levelTone("confidence", value))).toEqual([
      "bad",
      "bad",
      "medium",
      "good",
      "good",
    ]);
  });

  it("stress : l'inverse, un stress élevé est en rouge", () => {
    expect([1, 2, 3, 4, 5].map((value) => levelTone("stress", value))).toEqual([
      "good",
      "good",
      "medium",
      "bad",
      "bad",
    ]);
  });

  it("gestion et jugement : comme la confiance, haut = vert", () => {
    expect([1, 3, 5].map((value) => levelTone("management", value))).toEqual([
      "bad",
      "medium",
      "good",
    ]);
    expect([1, 3, 5].map((value) => levelTone("judgment", value))).toEqual([
      "bad",
      "medium",
      "good",
    ]);
  });
});
