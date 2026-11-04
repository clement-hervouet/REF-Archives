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
