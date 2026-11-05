/**
 * Dates calendaires (sans heure) au format ISO `AAAA-MM-JJ`, toujours vues depuis
 * Europe/Paris (§5.6). C'est le format des colonnes `date` de PostgreSQL : deux dates
 * de ce format se comparent directement comme des chaînes.
 */
import { ValidationError } from "./errors";

const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// `en-CA` produit déjà l'ordre année-mois-jour ; on reconstruit quand même la chaîne à
// partir des parties pour ne pas dépendre du séparateur choisi par la locale.
const parisDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Vrai si `value` est une date `AAAA-MM-JJ` qui existe dans le calendrier (pas de 31/02). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Lève une `ValidationError` si `value` n'est pas une date `AAAA-MM-JJ` valide. */
export function assertIsoDate(value: string): void {
  if (!isIsoDate(value)) {
    throw new ValidationError("invalid_iso_date");
  }
}

/**
 * Jour calendaire à Paris d'un instant UTC. Un match à 23h30 UTC le 31/12 a lieu le
 * 01/01 à Paris : c'est cette date qui choisit la ligne de barème en vigueur.
 */
export function toParisIsoDate(instant: Date): string {
  if (Number.isNaN(instant.getTime())) {
    throw new ValidationError("invalid_date");
  }
  let year = "";
  let month = "";
  let day = "";
  for (const part of parisDateFormat.formatToParts(instant)) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
  }
  return `${year}-${month}-${day}`;
}
