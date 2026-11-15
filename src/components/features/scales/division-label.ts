/**
 * Libellés d'une division pour l'affichage : complet (« Régional Féminin U15 ») et abrégé
 * (« RFU15 »), seul affiché dans la liste des niveaux du formulaire.
 */
import { fr } from "@/i18n/fr";
import type { Division, DivisionCategory, DivisionType } from "@/server/db/divisions";

const t = fr.scales.divisions;

type DivisionParts = Pick<Division, "category" | "type" | "level">;

// Élargi en dictionnaire : seuls quelques niveaux ont un nom d'usage.
const NAMED: Partial<
  Record<DivisionCategory, Record<DivisionType, Partial<Record<string, string>>>>
> = t.abbreviation.named;

export function divisionLabel(division: DivisionParts): string {
  return t.label
    .replace("{category}", t.category[division.category])
    .replace("{type}", t.type[division.type])
    .replace("{level}", division.level);
}

/**
 * Abréviation d'usage : catégorie, sexe et niveau collés (DM2, RFU15, NM3), sauf pour les
 * niveaux qui ont un nom d'usage (PRM, PNF, Pro A, LFB…). Un niveau Pro sans nom retombe
 * sur le code (PM3).
 */
export function divisionAbbreviation(division: DivisionParts): string {
  const name = NAMED[division.category]?.[division.type][division.level];
  if (name !== undefined) return name;
  return t.abbreviation.format
    .replace("{category}", t.abbreviation.category[division.category])
    .replace("{type}", t.abbreviation.type[division.type])
    .replace("{level}", division.level);
}
