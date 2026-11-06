/**
 * Distances : stockées en mètres aller-retour (`compensation.distance_m`), saisies en km
 * aller (bloc 6). Arithmétique entière, jamais de float sur une distance.
 */
import { ValidationError } from "./errors";

const NBSP = " ";

function assertMeters(distanceM: number): void {
  if (!Number.isSafeInteger(distanceM) || distanceM < 0) {
    throw new ValidationError("invalid_distance");
  }
}

/** Mètres → « 23,5 » (virgule, au plus 3 décimales, sans zéros inutiles). */
function metersToKm(meters: number): string {
  const km = Math.floor(meters / 1000);
  const rest = String(meters % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return rest === "" ? String(km) : `${String(km)},${rest}`;
}

/**
 * Valeur du champ « distance aller » pour modifier une indemnité : la moitié de
 * l'aller-retour stocké, ex. 47 000 m → « 23,5 ». Un aller-retour impair (saisi hors du
 * formulaire) est arrondi au mètre.
 */
export function oneWayKmInput(distanceM: number): string {
  assertMeters(distanceM);
  return metersToKm(Math.round(distanceM / 2));
}

/** Aller-retour pour l'affichage, ex. 47 000 m → « 47 km ». */
export function formatRoundTripKm(distanceM: number): string {
  assertMeters(distanceM);
  return `${metersToKm(distanceM)}${NBSP}km`;
}

/** Distance aller maximale saisie (2 000 km) ; l'aller-retour reste sous la borne SQL. */
export const MAX_ONE_WAY_DISTANCE_M = 2_000_000;

/** Km aller : jusqu'à 4 chiffres, au plus 3 décimales (le mètre), virgule ou point. */
export const ONE_WAY_KM_PATTERN = /^(\d{1,4})(?:[.,](\d{1,3}))?$/;

/** « 23,5 » km aller → 23 500 m. Suppose une chaîne qui respecte `ONE_WAY_KM_PATTERN`. */
export function oneWayKmToMeters(value: string): number {
  const [whole = "0", fraction = ""] = value.split(/[.,]/);
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
}

/**
 * Saisie « km aller » → mètres aller-retour, ou `null` si elle n'est pas valide (même
 * règle que le schéma du formulaire). Sans Zod : utilisable dans le navigateur (aperçu).
 */
export function parseOneWayDistance(value: string): number | null {
  const trimmed = value.trim();
  if (!ONE_WAY_KM_PATTERN.test(trimmed)) {
    return null;
  }
  const meters = oneWayKmToMeters(trimmed);
  return meters <= MAX_ONE_WAY_DISTANCE_M ? meters * 2 : null;
}
