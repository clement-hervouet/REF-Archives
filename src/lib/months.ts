/**
 * Mois calendaires `AAAA-MM`, vus depuis Europe/Paris (§5.6) : filtre de la liste des
 * indemnités et libellés des totaux mensuels.
 */
import { toParisIsoDate } from "./dates";
import { ValidationError } from "./errors";
import { parisLocalToUtc } from "./paris-time";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const monthFormat = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Vrai si `value` est un mois `AAAA-MM` valide. */
export function isMonth(value: string): boolean {
  return MONTH_PATTERN.test(value);
}

function parseMonth(month: string): { year: number; month: number } {
  const match = MONTH_PATTERN.exec(month);
  if (match === null) {
    throw new ValidationError("invalid_month");
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** Mois en cours à Paris à l'instant `now`. */
export function currentParisMonth(now: Date): string {
  return toParisIsoDate(now).slice(0, 7);
}

/** Mois suivant, ex. `2026-12` → `2027-01`. */
export function nextMonth(month: string): string {
  const { year, month: value } = parseMonth(month);
  return value === 12
    ? `${String(year + 1)}-01`
    : `${String(year)}-${String(value + 1).padStart(2, "0")}`;
}

/**
 * Bornes UTC d'un mois de Paris : `[from, to)`. Minuit existe toujours à Paris (les
 * changements d'heure ont lieu la nuit, à 2 h ou 3 h), la conversion ne peut pas échouer.
 */
export function parisMonthRange(month: string): { from: Date; to: Date } {
  parseMonth(month);
  return {
    from: parisLocalToUtc(`${month}-01`, "00:00"),
    to: parisLocalToUtc(`${nextMonth(month)}-01`, "00:00"),
  };
}

/** Libellé d'un mois, ex. `2026-11` → « novembre 2026 ». */
export function formatMonth(month: string): string {
  const { year, month: value } = parseMonth(month);
  return monthFormat.format(new Date(Date.UTC(year, value - 1, 1)));
}
