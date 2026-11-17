/**
 * Calcul du montant d'une indemnité (§5.1). Pur et en arithmétique entière : jamais de
 * float sur un montant. Le montant n'est pas stocké, il est recalculé depuis la ligne
 * de barème référencée par l'indemnité.
 */
import { ValidationError } from "@/lib/errors";

/**
 * Taux `numeric(6, 2)` tel que renvoyé par `pg` (une chaîne, ex. `"40.00"` ou `"42.5"`).
 * Au plus 4 chiffres avant la virgule et 2 après, comme la colonne.
 */
const CENTS_PER_KM_PATTERN = /^(\d{1,4})(?:\.(\d{1,2}))?$/;

/** Nombre maximal de matchs d'un plateau (§15.4.7), comme la contrainte de la colonne. */
export const MAX_GAME_COUNT = 10;

/** Mètres par km × centièmes de centime par centime : diviseur pour obtenir des centimes. */
const MILEAGE_DIVISOR = 1000 * 100;

/**
 * Convertit un taux en centimes par km (`"42.50"`) en centièmes de centime par km (`4250`),
 * un entier exact.
 */
export function parseCentsPerKm(value: string): number {
  const match = CENTS_PER_KM_PATTERN.exec(value);
  if (match === null) {
    throw new ValidationError("invalid_cents_per_km");
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}

/**
 * Indemnité kilométrique en centimes, arrondie au centime le plus proche (demi vers le
 * haut). `distanceM` est la distance en mètres (colonne `distance_m`).
 *
 * Bornes : distance ≤ 2^31 − 1 (integer PostgreSQL) et taux ≤ 999 999 centièmes, donc le
 * produit reste sous 2^53 et le calcul en `number` est exact.
 */
export function computeMileageCents(distanceM: number, centsPerKm: string): number {
  if (!Number.isInteger(distanceM) || distanceM < 0 || distanceM > 2_147_483_647) {
    throw new ValidationError("invalid_distance");
  }
  const rate = parseCentsPerKm(centsPerKm);
  return Math.floor((distanceM * rate + MILEAGE_DIVISOR / 2) / MILEAGE_DIVISOR);
}

export type CompensationRate = {
  gameAmountCents: number;
  /** Taux en centimes par km, chaîne `numeric` (ex. `"40.00"`). */
  centsPerKm: string;
};

export type CompensationAmount = {
  gameCents: number;
  mileageCents: number;
  totalCents: number;
};

export type CompensationTravel = {
  /** Distance aller-retour en mètres (colonne `distance_m`). */
  distanceM: number;
  /**
   * Doublé (§15.4.5) : déplacement déjà indemnisé sur un autre match du même jour au même
   * endroit. Le kilométrage vaut alors 0 ; la distance reste valide et enregistrée.
   */
  travelShared: boolean;
  /**
   * Nombre de matchs payés au montant par match : celui d'un plateau (§15.4.7), sinon 1
   * (colonne `game_count`, NULL hors plateau).
   */
  gameCount: number;
};

/**
 * Montant complet d'une indemnité : matchs (montant par match × nombre de matchs, 1 hors
 * plateau) + kilométrage (0 sur le second match d'un doublé).
 */
export function computeCompensation(
  rate: CompensationRate,
  travel: CompensationTravel,
): CompensationAmount {
  if (!Number.isSafeInteger(rate.gameAmountCents) || rate.gameAmountCents < 0) {
    throw new ValidationError("invalid_game_amount");
  }
  if (
    !Number.isInteger(travel.gameCount) ||
    travel.gameCount < 1 ||
    travel.gameCount > MAX_GAME_COUNT
  ) {
    throw new ValidationError("invalid_game_count");
  }
  // Distance validée même sur un doublé : une valeur impossible reste une erreur.
  const fullMileageCents = computeMileageCents(travel.distanceM, rate.centsPerKm);
  const mileageCents = travel.travelShared ? 0 : fullMileageCents;
  const gameCents = rate.gameAmountCents * travel.gameCount;
  return { gameCents, mileageCents, totalCents: gameCents + mileageCents };
}
