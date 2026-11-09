/**
 * Données du tableau de saison de « Mes indemnités » (bloc 10). Pur : ni base, ni React.
 */
import { seasonOf } from "@/lib/seasons";
import { sumTotals } from "./monthly-totals";
import type { MonthlyTotal } from "./monthly-totals";

export type SeasonView = {
  /** Année de début de la saison du mois affiché. */
  season: number;
  /** Mois de cette saison qui ont des indemnités, de juillet à juin. */
  months: MonthlyTotal[];
  seasonTotal: MonthlyTotal;
  /** Autres saisons ayant des indemnités, de la plus récente à la plus ancienne, avec le mois à ouvrir (le plus récent). */
  otherSeasons: { season: number; month: string }[];
};

/** `totals` : totaux mensuels du plus récent au plus ancien (`computeMonthlyTotals`). */
export function buildSeasonView(totals: readonly MonthlyTotal[], month: string): SeasonView {
  const season = seasonOf(month);
  const months = totals
    .filter((total) => seasonOf(total.month) === season)
    .sort((a, b) => (a.month < b.month ? -1 : 1));
  const otherSeasons: { season: number; month: string }[] = [];
  for (const total of totals) {
    const other = seasonOf(total.month);
    // `totals` est trié du plus récent au plus ancien : le premier mois vu est le plus récent.
    if (other !== season && !otherSeasons.some((entry) => entry.season === other)) {
      otherSeasons.push({ season: other, month: total.month });
    }
  }
  return { season, months, seasonTotal: sumTotals(String(season), months), otherSeasons };
}
