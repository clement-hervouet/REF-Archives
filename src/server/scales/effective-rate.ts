/**
 * Choix de la ligne de barème en vigueur à une date (§5.1 : historisation). Pur : ni base,
 * ni React. Les lignes sont immuables ; une nouvelle valeur = une nouvelle ligne datée.
 */
import { assertIsoDate } from "@/lib/dates";

/** Ce dont le calcul a besoin d'une ligne `scale_rate`. */
export type DatedRate = {
  /** Date d'application `AAAA-MM-JJ` (Europe/Paris). */
  effectiveFrom: string;
};

/**
 * Ligne en vigueur à `onDate` : la plus récente dont la date d'application est
 * antérieure ou égale à `onDate`. Renvoie `null` si le barème n'a encore aucune ligne
 * à cette date (match antérieur à sa première ligne) : l'appelant demande alors de
 * choisir un autre barème ou d'ajouter une ligne.
 */
export function findEffectiveRate<T extends DatedRate>(
  rates: readonly T[],
  onDate: string,
): T | null {
  assertIsoDate(onDate);
  let best: T | null = null;
  for (const rate of rates) {
    assertIsoDate(rate.effectiveFrom);
    // Format AAAA-MM-JJ : l'ordre des chaînes est l'ordre chronologique.
    if (rate.effectiveFrom > onDate) {
      continue;
    }
    if (best === null || rate.effectiveFrom > best.effectiveFrom) {
      best = rate;
    }
  }
  return best;
}