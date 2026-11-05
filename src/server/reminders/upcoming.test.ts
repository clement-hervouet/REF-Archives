import { describe, expect, it } from "vitest";
import { upcomingRanges } from "./upcoming";

describe("upcomingRanges", () => {
  it("affiche le weekend de la semaine en cours, puis 8 semaines", () => {
    expect(upcomingRanges("2026-11-05")).toEqual({
      saturday: "2026-11-07",
      weekend: {
        from: new Date("2026-11-05T23:00:00.000Z"),
        to: new Date("2026-11-08T23:00:00.000Z"),
      },
      later: {
        from: new Date("2026-11-08T23:00:00.000Z"),
        // Lundi 04/01/2027 00:00 à Paris.
        to: new Date("2027-01-03T23:00:00.000Z"),
      },
    });
  });

  it("le dimanche, garde le weekend qui se termine", () => {
    expect(upcomingRanges("2026-11-08").saturday).toBe("2026-11-07");
  });

  it("le lundi, passe au weekend suivant", () => {
    expect(upcomingRanges("2026-11-09").saturday).toBe("2026-11-14");
  });
});
