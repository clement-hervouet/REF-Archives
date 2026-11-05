/**
 * Périodes affichées par la page « À venir » et l'accueil : le weekend en cours ou le
 * prochain (du vendredi au dimanche, voir `parisWeekendRange`), puis les semaines suivantes.
 */
import { parisLocalToUtc } from "@/lib/paris-time";
import { addDays, parisWeekendRange, saturdayOf } from "@/lib/weeks";

/** Nombre de semaines affichées après le weekend. */
export const UPCOMING_LATER_WEEKS = 8;

export type UpcomingRanges = {
  /** Samedi du weekend affiché : celui de la semaine en cours (lundi → dimanche). */
  saturday: string;
  weekend: { from: Date; to: Date };
  later: { from: Date; to: Date };
};

/** Périodes à afficher le jour `today` (date de Paris). */
export function upcomingRanges(today: string): UpcomingRanges {
  const saturday = saturdayOf(today);
  const weekend = parisWeekendRange(saturday);
  // Lundi qui suit le weekend + N semaines, à minuit à Paris.
  const end = parisLocalToUtc(addDays(saturday, 2 + 7 * UPCOMING_LATER_WEEKS), "00:00");
  return { saturday, weekend, later: { from: weekend.to, to: end } };
}
