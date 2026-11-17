/**
 * Période des plateaux (§15.4.7) : de juillet à fin octobre, début de saison FFBB. Les
 * niveaux de plateau ne sont proposés dans la liste que pour un match de cette période.
 */
import { isIsoDate } from "@/lib/dates";

/** Vrai si le jour `AAAA-MM-JJ` tombe entre le 1er juillet et le 31 octobre. */
export function isPlateauPeriod(isoDate: string): boolean {
  if (!isIsoDate(isoDate)) {
    return false;
  }
  const month = Number(isoDate.slice(5, 7));
  return month >= 7 && month <= 10;
}
