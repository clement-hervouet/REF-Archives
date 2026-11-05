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

/** Montant complet d'une indemnité : match + kilométrage. */
export function computeCompensation(rate: CompensationRate, distanceM: number): CompensationAmount {
  if (!Number.isSafeInteger(rate.gameAmountCents) || rate.gameAmountCents < 0) {
    throw new ValidationError("invalid_game_amount");
  }
  const mileageCents = computeMileageCents(distanceM, rate.centsPerKm);
  return {
    gameCents: rate.gameAmountCents,
    mileageCents,
    totalCents: rate.gameAmountCents + mileageCents,
  };
}
