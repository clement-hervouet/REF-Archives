import { describe, expect, it } from "vitest";
import { computeMonthlyTotals } from "./monthly-totals";
import { buildSeasonView } from "./season-view";

function item(startsAt: string, cents: number) {
  return {
    startsAt: new Date(startsAt),
    amount: { gameCents: cents, mileageCents: 0, totalCents: cents },
    status: "paid" as const,
  };
}

const totals = computeMonthlyTotals([
  item("2025-11-08T18:00:00Z", 1000), // saison 2025
  item("2026-03-14T18:00:00Z", 2000), // saison 2025
  item("2026-09-19T17:00:00Z", 3000), // saison 2026
  item("2026-11-14T18:00:00Z", 4000), // saison 2026
  item("2027-02-06T18:00:00Z", 5000), // saison 2026
  item("2027-09-11T17:00:00Z", 6000), // saison 2027
]);

describe("buildSeasonView", () => {
  it("garde les mois de la saison du mois affiché, de juillet à juin", () => {
    const view = buildSeasonView(totals, "2026-11");
    expect(view.season).toBe(2026);
    expect(view.months.map((total) => total.month)).toEqual(["2026-09", "2026-11", "2027-02"]);
    expect(view.seasonTotal.totalCents).toBe(12_000);
    expect(view.seasonTotal.gameCount).toBe(3);
  });

  it("liste les autres saisons, la plus récente d'abord, avec leur mois le plus récent", () => {
    expect(buildSeasonView(totals, "2026-11").otherSeasons).toEqual([
      { season: 2027, month: "2027-09" },
      { season: 2025, month: "2026-03" },
    ]);
  });

  it("fonctionne pour un mois sans indemnité (saison vide)", () => {
    const view = buildSeasonView(totals, "2030-01");
    expect(view.season).toBe(2029);
    expect(view.months).toEqual([]);
    expect(view.seasonTotal.totalCents).toBe(0);
    expect(view.otherSeasons).toHaveLength(3);
  });
});
