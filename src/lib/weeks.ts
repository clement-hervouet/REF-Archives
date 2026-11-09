/**
 * Calendrier des semaines et des weekends, en jours calendaires `AAAA-MM-JJ` vus depuis
 * Europe/Paris (§5.6). Les calculs portent sur des dates sans heure : ils ne dépendent ni
 * du fuseau du serveur ni des changements d'heure.
 */
import { assertIsoDate } from "./dates";
import { ValidationError } from "./errors";
import { parisLocalToUtc } from "./paris-time";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const ISO_WEEKDAYS = [7, 1, 2, 3, 4, 5, 6] as const;

// Minuit UTC du jour : un simple repère de calendrier, pas un instant réel à Paris.
function toUtcMidnight(isoDate: string): Date {
  assertIsoDate(isoDate);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Date décalée de `days` jours (négatif pour reculer), ex. `2026-12-31` + 1 → `2027-01-01`. */
export function addDays(isoDate: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new ValidationError("invalid_day_offset");
  }
  return new Date(toUtcMidnight(isoDate).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant), ex. 06/11 → 08/11 = 2. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / DAY_MS);
}

/** Jour de la semaine ISO d'une date (1 = lundi … 7 = dimanche). */
export function isoWeekday(isoDate: string): IsoWeekday {
  return ISO_WEEKDAYS[toUtcMidnight(isoDate).getUTCDay()] ?? 7;
}

/** Lundi de la semaine qui contient `isoDate`. */
export function mondayOf(isoDate: string): string {
  return addDays(isoDate, 1 - isoWeekday(isoDate));
}

/** Samedi de la semaine qui contient `isoDate` (le weekend de la semaine). */
export function saturdayOf(isoDate: string): string {
  return addDays(mondayOf(isoDate), 5);
}

/**
 * Bornes UTC `[from, to)` du weekend dont le samedi est `saturday` : du vendredi 00:00 au
 * lundi 00:00 à Paris. Le vendredi est inclus : les matchs seniors s'y jouent souvent en
 * soirée. Minuit existe toujours à Paris, la conversion ne peut pas échouer.
 */
export function parisWeekendRange(saturday: string): { from: Date; to: Date } {
  if (isoWeekday(saturday) !== 6) {
    throw new ValidationError("not_a_saturday");
  }
  return {
    from: parisLocalToUtc(addDays(saturday, -1), "00:00"),
    to: parisLocalToUtc(addDays(saturday, 2), "00:00"),
  };
}

const shortDateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/** Libellé court d'une date, ex. `2026-12-12` → « 12/12 ». */
export function formatShortDate(isoDate: string): string {
  return shortDateFormat.format(toUtcMidnight(isoDate));
}
