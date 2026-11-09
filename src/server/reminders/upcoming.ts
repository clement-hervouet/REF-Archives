/**
 * Périodes affichées par la page « À venir » et l'accueil : le weekend en cours ou le
 * prochain (du vendredi au dimanche, voir `parisWeekendRange`), puis les semaines suivantes.
 */
import { toParisIsoDate } from "@/lib/dates";
import { parisLocalToUtc } from "@/lib/paris-time";
import { addDays, daysBetween, mondayOf, parisWeekendRange, saturdayOf } from "@/lib/weeks";

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

// ─── Présentation de la page « À venir » (bloc 10) ──────────────────────────

/** Écart en jours entre aujourd'hui et le jour d'un match (dates de Paris). */
export type RelativeDay =
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "days"; days: number }
  /** Match déjà passé (ex. vendredi soir vu le samedi) : pas de libellé. */
  | { kind: "past" };

export function relativeDay(today: string, startsAt: Date): RelativeDay {
  const days = daysBetween(today, toParisIsoDate(startsAt));
  if (days < 0) return { kind: "past" };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  return { kind: "days", days };
}

export type WeekGroup<T> = {
  /** Lundi et dimanche de la semaine (`AAAA-MM-JJ`, Paris). */
  monday: string;
  sunday: string;
  matches: T[];
};

/**
 * Regroupe des matchs (déjà triés par date) par semaine du lundi au dimanche, à Paris.
 * Les semaines sans match n'apparaissent pas.
 */
export function groupByWeek<T extends { startsAt: Date }>(matches: readonly T[]): WeekGroup<T>[] {
  const groups: WeekGroup<T>[] = [];
  for (const match of matches) {
    const monday = mondayOf(toParisIsoDate(match.startsAt));
    const last = groups[groups.length - 1];
    if (last?.monday === monday) {
      last.matches.push(match);
    } else {
      groups.push({ monday, sunday: addDays(monday, 6), matches: [match] });
    }
  }
  return groups;
}
