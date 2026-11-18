/**
 * Périodes affichées par la page « À venir » et l'accueil : la semaine en cours, d'aujourd'hui
 * au dimanche (matchs de semaine compris), puis les semaines suivantes, du lundi au dimanche.
 */
import { toParisIsoDate } from "@/lib/dates";
import { parisLocalToUtc } from "@/lib/paris-time";
import { addDays, daysBetween, mondayOf } from "@/lib/weeks";

/** Nombre de semaines affichées après le weekend. */
export const UPCOMING_LATER_WEEKS = 8;

export type UpcomingRanges = {
  /** Dimanche de la semaine en cours (lundi → dimanche, Paris). */
  sunday: string;
  /** D'aujourd'hui 00:00 au lundi suivant 00:00, à Paris : les matchs déjà passés des
   *  jours précédents de la semaine n'y sont plus. */
  week: { from: Date; to: Date };
  later: { from: Date; to: Date };
};

/** Périodes à afficher le jour `today` (date de Paris). */
export function upcomingRanges(today: string): UpcomingRanges {
  const nextMonday = addDays(mondayOf(today), 7);
  const week = {
    from: parisLocalToUtc(today, "00:00"),
    to: parisLocalToUtc(nextMonday, "00:00"),
  };
  // Lundi suivant + N semaines, à minuit à Paris.
  const end = parisLocalToUtc(addDays(nextMonday, 7 * UPCOMING_LATER_WEEKS), "00:00");
  return { sunday: addDays(nextMonday, -1), week, later: { from: week.to, to: end } };
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
