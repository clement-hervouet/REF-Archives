/**
 * Saisons sportives (bloc 10) : du 1er juillet au 30 juin, comme les saisons FFBB.
 * Une saison est désignée par son année de début (`2026` = saison 2026-2027).
 * Pur : ni base ni React.
 */
import { isMonth } from "./months";
import { ValidationError } from "./errors";

/** Premier mois d'une saison (juillet). */
export const SEASON_FIRST_MONTH = 7;

/** Année de début de la saison d'un mois `AAAA-MM` : juillet 2026 → 2026, juin 2027 → 2026. */
export function seasonOf(month: string): number {
  if (!isMonth(month)) {
    throw new ValidationError("invalid_month");
  }
  const year = Number(month.slice(0, 4));
  return Number(month.slice(5, 7)) >= SEASON_FIRST_MONTH ? year : year - 1;
}

/** Libellé court, ex. `2026` → « 2026-2027 ». */
export function seasonLabel(startYear: number): string {
  return `${String(startYear)}-${String(startYear + 1)}`;
}
