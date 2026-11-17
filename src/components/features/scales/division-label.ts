/**
 * Libellés d'une division pour l'affichage : complet (« Régional Féminin U15 ») et abrégé
 * (« RFU15 »), seul affiché dans la liste des niveaux du formulaire.
 *
 * Coupes (§15.4.6) : le nom d'usage dépend du lieu du match, comme l'organisme qui verse.
 * Coupe départementale « COUPE 56 SM 1/2 », coupe régionale « CBU18F (1/16) » (code de la
 * ligue), Coupe de France « CDF U18F 1/8 ». Sans match (barèmes, niveaux par défaut) :
 * « Coupe départementale Seniors Masculin ».
 *
 * Plateaux (§15.4.7) : départemental selon le département du match « PlaD56MU15 », régional
 * « PlaRMU15 » ; sans match « Plateau départemental U15 Masculin ».
 */
import { fr } from "@/i18n/fr";
import { deducePayer, leagueCupCode } from "@/lib/payers";
import type { DepartmentCode } from "@/lib/payers";
import type {
  Division,
  DivisionCategory,
  DivisionLevel,
  DivisionType,
} from "@/server/db/divisions";
import type { MatchDivision } from "@/server/db/match-info";

const t = fr.scales.divisions;
const cup = t.cup;
const plateau = t.plateau;

type DivisionParts = Pick<Division, "category" | "type" | "level" | "cup" | "plateau">;

// Élargi en dictionnaire : seuls quelques niveaux ont un nom d'usage.
const NAMED: Partial<
  Record<DivisionCategory, Record<DivisionType, Partial<Record<string, string>>>>
> = t.abbreviation.named;

/** Portée d'une coupe : un niveau Pro n'a pas de coupe, il serait traité comme national. */
type CupScope = keyof typeof cup.name;

function cupScope(category: DivisionCategory): CupScope {
  return category === "Pro" ? "National" : category;
}

/** Portée d'un plateau : départemental ou régional (un autre niveau serait traité en régional). */
type PlateauScope = keyof typeof plateau.name;

function plateauScope(category: DivisionCategory): PlateauScope {
  return category === "Departemental" ? "Departemental" : "Regional";
}

// Élargi : le niveau d'une coupe est U13, U15, U18 ou Seniors ; un autre garde son code.
const CUP_LEVEL: Partial<Record<DivisionLevel, string>> = cup.abbreviation.level;

export function divisionLabel(division: DivisionParts): string {
  if (division.plateau) {
    return plateau.label
      .replace("{plateau}", plateau.name[plateauScope(division.category)])
      .replace("{level}", division.level)
      .replace("{type}", t.type[division.type]);
  }
  if (division.cup) {
    return cup.label
      .replace("{cup}", cup.name[cupScope(division.category)])
      .replace("{level}", division.level)
      .replace("{type}", t.type[division.type]);
  }
  return t.label
    .replace("{category}", t.category[division.category])
    .replace("{type}", t.type[division.type])
    .replace("{level}", division.level);
}

/**
 * Nom d'usage d'une coupe sans le tour, selon le département du match : « COUPE 56 SM »,
 * « CBU18F », « CDF U18F » ; « COUPE DÉP. SM » ou « COUPE RÉG. U18F » si le lieu est inconnu.
 */
function cupAbbreviation(division: DivisionParts, department: DepartmentCode | null): string {
  const scope = cupScope(division.category);
  const parts = (format: string) =>
    format
      .replace("{level}", CUP_LEVEL[division.level] ?? division.level)
      .replace("{type}", t.abbreviation.type[division.type]);
  if (scope === "National") {
    return parts(cup.abbreviation.national);
  }
  const organizer = department === null ? null : deducePayer(scope, department);
  if (organizer?.kind === "committee") {
    return parts(cup.abbreviation.departmental).replace("{department}", organizer.department);
  }
  if (organizer?.kind === "league") {
    const code = leagueCupCode(organizer.league);
    if (code !== null) {
      return parts(cup.abbreviation.regional).replace("{league}", code);
    }
  }
  return parts(
    scope === "Departemental"
      ? cup.abbreviation.departmentalUnknown
      : cup.abbreviation.regionalUnknown,
  );
}

/** Nom d'usage d'un plateau : « PlaD56MU15 » (« PlaDMU15 » si le lieu est inconnu), « PlaRMU15 ». */
function plateauAbbreviation(division: DivisionParts, department: DepartmentCode | null): string {
  const format =
    plateauScope(division.category) === "Regional"
      ? plateau.abbreviation.regional
      : department === null
        ? plateau.abbreviation.departmentalUnknown
        : plateau.abbreviation.departmental.replace("{department}", department);
  return format
    .replace("{level}", division.level)
    .replace("{type}", t.abbreviation.type[division.type]);
}

/**
 * Abréviation d'usage : catégorie, sexe et niveau collés (DM2, RFU15, NM3), sauf pour les
 * niveaux qui ont un nom d'usage (PRM, PNF, Pro A, LFB…). Un niveau Pro sans nom retombe
 * sur le code (PM3). Une coupe prend son nom d'usage d'après le département du match.
 */
export function divisionAbbreviation(
  division: DivisionParts,
  department: DepartmentCode | null = null,
): string {
  if (division.plateau) {
    return plateauAbbreviation(division, department);
  }
  if (division.cup) {
    return cupAbbreviation(division, department);
  }
  const name = NAMED[division.category]?.[division.type][division.level];
  if (name !== undefined) return name;
  return t.abbreviation.format
    .replace("{category}", t.abbreviation.category[division.category])
    .replace("{type}", t.abbreviation.type[division.type])
    .replace("{level}", division.level);
}

/**
 * Niveau d'un match tel qu'affiché dans les listes, À venir, emails, iCal et notes : le
 * libellé complet d'un championnat, le nom d'usage d'une coupe avec son tour
 * (« COUPE 56 SM 1/2 », « CBU18F (1/16) ») ou d'un plateau (« PlaD56MU15 »).
 */
export function matchLevelLabel(level: MatchDivision): string {
  if (level.plateau) {
    return plateauAbbreviation(level, level.department);
  }
  if (!level.cup) {
    return divisionLabel(level);
  }
  const name = cupAbbreviation(level, level.department);
  if (level.cupRound === null) {
    return name;
  }
  return cup.abbreviation.withRound[cupScope(level.category)]
    .replace("{name}", name)
    .replace("{round}", cup.roundShort[level.cupRound]);
}

export type DivisionGroup = {
  /** Clé stable : la catégorie, préfixée de `plateau-` ou `cup-` pour ces groupes. */
  key: string;
  label: string;
  divisions: Division[];
};

/**
 * Niveaux regroupés dans l'ordre reçu : une catégorie de championnat par groupe
 * (Départemental, Régional…), puis un groupe par portée de plateau et de coupe, en bas.
 */
export function groupDivisions(divisions: readonly Division[]): DivisionGroup[] {
  const groups = new Map<string, DivisionGroup>();
  for (const division of divisions) {
    const key = division.plateau
      ? `plateau-${division.category}`
      : division.cup
        ? `cup-${division.category}`
        : division.category;
    const label = division.plateau
      ? plateau.group[plateauScope(division.category)]
      : division.cup
        ? cup.group[cupScope(division.category)]
        : t.category[division.category];
    const group = groups.get(key) ?? { key, label, divisions: [] };
    group.divisions.push(division);
    groups.set(key, group);
  }
  return [...groups.values()];
}
