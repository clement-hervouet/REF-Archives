/**
 * Libellé d'une division pour l'affichage, ex. « Régional Féminin U15 ».
 */
import { fr } from "@/i18n/fr";
import type { Division } from "@/server/db/divisions";

const t = fr.scales.divisions;

export function divisionLabel(division: Pick<Division, "category" | "type" | "level">): string {
  return t.label
    .replace("{category}", t.category[division.category])
    .replace("{type}", t.type[division.type])
    .replace("{level}", division.level);
}
