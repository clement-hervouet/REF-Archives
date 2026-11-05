import { describe, expect, it } from "vitest";
import { computeMonthlyTotals } from "./monthly-totals";

function item(startsAt: string, gameCents: number, mileageCents: number) {
  return {
    startsAt: new Date(startsAt),
    amount: { gameCents, mileageCents, totalCents: gameCents + mileageCents },
  };
}

describe("computeMonthlyTotals", () => {
  it("renvoie une liste vide sans indemnité", () => {
    expect(computeMonthlyTotals([])).toEqual([]);
  });

  it("additionne les indemnités d'un même mois", () => {
    expect(
      computeMonthlyTotals([
        item("2026-11-14T18:00:00Z", 4800, 1998),
        item("2026-11-21T19:00:00Z", 3000, 960),
      ]),
    ).toEqual([
      { month: "2026-11", gameCount: 2, gameCents: 7800, mileageCents: 2958, totalCents: 10758 },
    ]);
  });

  it("trie du mois le plus récent au plus ancien, toutes années confondues", () => {
    const months = computeMonthlyTotals([
      item("2025-12-06T18:00:00Z", 3000, 0),
      item("2026-11-14T18:00:00Z", 3000, 0),
      item("2026-01-10T18:00:00Z", 3000, 0),
    ]).map((total) => total.month);
    expect(months).toEqual(["2026-11", "2026-01", "2025-12"]);
  });

  it("classe un match selon le mois à Paris, pas en UTC", () => {
    // 31/10/2026 23:30 UTC = 01/11/2026 00:30 à Paris (heure d'hiver).
    const [total] = computeMonthlyTotals([item("2026-10-31T23:30:00Z", 3000, 0)]);
    expect(total?.month).toBe("2026-11");
  });

  it("garde un match tardif dans son mois à Paris", () => {
    // 30/09/2026 21:45 UTC = 30/09/2026 23:45 à Paris (heure d'été).
    const [total] = computeMonthlyTotals([item("2026-09-30T21:45:00Z", 3000, 0)]);
    expect(total?.month).toBe("2026-09");
  });
});
