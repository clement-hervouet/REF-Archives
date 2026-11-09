import { describe, expect, it } from "vitest";
import { formatAverage, hasAnyAverage } from "./level-averages";

const EMPTY = { average: null, count: 0 };

describe("formatAverage", () => {
  it("une décimale, virgule française", () => {
    expect(formatAverage(3.75)).toBe("3,8");
    expect(formatAverage(4)).toBe("4,0");
    expect(formatAverage(2.04)).toBe("2,0");
  });
});

describe("hasAnyAverage", () => {
  it("faux tant qu'aucune échelle n'est renseignée", () => {
    const none = { confidence: EMPTY, stress: EMPTY, management: EMPTY, judgment: EMPTY };
    expect(hasAnyAverage(none)).toBe(false);
    expect(hasAnyAverage({ ...none, judgment: { average: 5, count: 1 } })).toBe(true);
  });
});
