/**
 * Organisme qui verse une indemnité (bloc 10) : comité départemental, ligue régionale ou
 * Fédération. Déduit du niveau du match et du département de son adresse, sauf choix
 * explicite sur l'indemnité (colonne `compensation.payer`).
 *
 * - Départemental → comité du département du match (« CD35 ») ;
 * - Régional → ligue de la région du département (« Ligue de Bretagne ») ;
 * - National et Pro → « Fédération ».
 *
 * Les ligues suivent les régions administratives (réforme FFBB de 2016), outre-mer compris.
 * Données figées ici : sans dépendance, utilisable côté client comme côté serveur.
 */

export type DepartmentCode = string;

/** Départements : code (« 35 », « 2A », « 971 ») et nom, dans l'ordre des codes. */
export const DEPARTMENTS: readonly { code: DepartmentCode; name: string }[] = [
  { code: "01", name: "Ain" },
  { code: "02", name: "Aisne" },
  { code: "03", name: "Allier" },
  { code: "04", name: "Alpes-de-Haute-Provence" },
  { code: "05", name: "Hautes-Alpes" },
  { code: "06", name: "Alpes-Maritimes" },
  { code: "07", name: "Ardèche" },
  { code: "08", name: "Ardennes" },
  { code: "09", name: "Ariège" },
  { code: "10", name: "Aube" },
  { code: "11", name: "Aude" },
  { code: "12", name: "Aveyron" },
  { code: "13", name: "Bouches-du-Rhône" },
  { code: "14", name: "Calvados" },
  { code: "15", name: "Cantal" },
  { code: "16", name: "Charente" },
  { code: "17", name: "Charente-Maritime" },
  { code: "18", name: "Cher" },
  { code: "19", name: "Corrèze" },
  { code: "2A", name: "Corse-du-Sud" },
  { code: "2B", name: "Haute-Corse" },
  { code: "21", name: "Côte-d'Or" },
  { code: "22", name: "Côtes-d'Armor" },
  { code: "23", name: "Creuse" },
  { code: "24", name: "Dordogne" },
  { code: "25", name: "Doubs" },
  { code: "26", name: "Drôme" },
  { code: "27", name: "Eure" },
  { code: "28", name: "Eure-et-Loir" },
  { code: "29", name: "Finistère" },
  { code: "30", name: "Gard" },
  { code: "31", name: "Haute-Garonne" },
  { code: "32", name: "Gers" },
  { code: "33", name: "Gironde" },
  { code: "34", name: "Hérault" },
  { code: "35", name: "Ille-et-Vilaine" },
  { code: "36", name: "Indre" },
  { code: "37", name: "Indre-et-Loire" },
  { code: "38", name: "Isère" },
  { code: "39", name: "Jura" },
  { code: "40", name: "Landes" },
  { code: "41", name: "Loir-et-Cher" },
  { code: "42", name: "Loire" },
  { code: "43", name: "Haute-Loire" },
  { code: "44", name: "Loire-Atlantique" },
  { code: "45", name: "Loiret" },
  { code: "46", name: "Lot" },
  { code: "47", name: "Lot-et-Garonne" },
  { code: "48", name: "Lozère" },
  { code: "49", name: "Maine-et-Loire" },
  { code: "50", name: "Manche" },
  { code: "51", name: "Marne" },
  { code: "52", name: "Haute-Marne" },
  { code: "53", name: "Mayenne" },
  { code: "54", name: "Meurthe-et-Moselle" },
  { code: "55", name: "Meuse" },
  { code: "56", name: "Morbihan" },
  { code: "57", name: "Moselle" },
  { code: "58", name: "Nièvre" },
  { code: "59", name: "Nord" },
  { code: "60", name: "Oise" },
  { code: "61", name: "Orne" },
  { code: "62", name: "Pas-de-Calais" },
  { code: "63", name: "Puy-de-Dôme" },
  { code: "64", name: "Pyrénées-Atlantiques" },
  { code: "65", name: "Hautes-Pyrénées" },
  { code: "66", name: "Pyrénées-Orientales" },
  { code: "67", name: "Bas-Rhin" },
  { code: "68", name: "Haut-Rhin" },
  { code: "69", name: "Rhône" },
  { code: "70", name: "Haute-Saône" },
  { code: "71", name: "Saône-et-Loire" },
  { code: "72", name: "Sarthe" },
  { code: "73", name: "Savoie" },
  { code: "74", name: "Haute-Savoie" },
  { code: "75", name: "Paris" },
  { code: "76", name: "Seine-Maritime" },
  { code: "77", name: "Seine-et-Marne" },
  { code: "78", name: "Yvelines" },
  { code: "79", name: "Deux-Sèvres" },
  { code: "80", name: "Somme" },
  { code: "81", name: "Tarn" },
  { code: "82", name: "Tarn-et-Garonne" },
  { code: "83", name: "Var" },
  { code: "84", name: "Vaucluse" },
  { code: "85", name: "Vendée" },
  { code: "86", name: "Vienne" },
  { code: "87", name: "Haute-Vienne" },
  { code: "88", name: "Vosges" },
  { code: "89", name: "Yonne" },
  { code: "90", name: "Territoire de Belfort" },
  { code: "91", name: "Essonne" },
  { code: "92", name: "Hauts-de-Seine" },
  { code: "93", name: "Seine-Saint-Denis" },
  { code: "94", name: "Val-de-Marne" },
  { code: "95", name: "Val-d'Oise" },
  { code: "971", name: "Guadeloupe" },
  { code: "972", name: "Martinique" },
  { code: "973", name: "Guyane" },
  { code: "974", name: "La Réunion" },
  { code: "976", name: "Mayotte" },
];

/** Ligues régionales : identifiant stable, nom affiché, départements couverts. */
export const LEAGUES: readonly { key: string; name: string; departments: readonly string[] }[] = [
  {
    key: "auvergne-rhone-alpes",
    name: "Ligue d'Auvergne-Rhône-Alpes",
    departments: ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
  },
  {
    key: "bourgogne-franche-comte",
    name: "Ligue de Bourgogne-Franche-Comté",
    departments: ["21", "25", "39", "58", "70", "71", "89", "90"],
  },
  { key: "bretagne", name: "Ligue de Bretagne", departments: ["22", "29", "35", "56"] },
  {
    key: "centre-val-de-loire",
    name: "Ligue du Centre-Val de Loire",
    departments: ["18", "28", "36", "37", "41", "45"],
  },
  { key: "corse", name: "Ligue de Corse", departments: ["2A", "2B"] },
  {
    key: "grand-est",
    name: "Ligue du Grand Est",
    departments: ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
  },
  {
    key: "hauts-de-france",
    name: "Ligue des Hauts-de-France",
    departments: ["02", "59", "60", "62", "80"],
  },
  {
    key: "ile-de-france",
    name: "Ligue d'Île-de-France",
    departments: ["75", "77", "78", "91", "92", "93", "94", "95"],
  },
  { key: "normandie", name: "Ligue de Normandie", departments: ["14", "27", "50", "61", "76"] },
  {
    key: "nouvelle-aquitaine",
    name: "Ligue de Nouvelle-Aquitaine",
    departments: ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
  },
  {
    key: "occitanie",
    name: "Ligue d'Occitanie",
    departments: ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
  },
  {
    key: "pays-de-la-loire",
    name: "Ligue des Pays de la Loire",
    departments: ["44", "49", "53", "72", "85"],
  },
  {
    key: "provence-alpes-cote-d-azur",
    name: "Ligue Provence-Alpes-Côte d'Azur",
    departments: ["04", "05", "06", "13", "83", "84"],
  },
  { key: "guadeloupe", name: "Ligue de la Guadeloupe", departments: ["971"] },
  { key: "martinique", name: "Ligue de la Martinique", departments: ["972"] },
  { key: "guyane", name: "Ligue de la Guyane", departments: ["973"] },
  { key: "la-reunion", name: "Ligue de La Réunion", departments: ["974"] },
  { key: "mayotte", name: "Ligue de Mayotte", departments: ["976"] },
];

export type Payer =
  | { kind: "committee"; department: DepartmentCode }
  | { kind: "league"; league: string }
  | { kind: "federation" };

/** Niveau du match (même valeurs que l'énumération `division_division`). */
export type PayerCategory = "Departemental" | "Regional" | "National" | "Pro";

const DEPARTMENT_CODES = new Set(DEPARTMENTS.map((department) => department.code));
const LEAGUE_BY_DEPARTMENT = new Map(
  LEAGUES.flatMap((league) => league.departments.map((code) => [code, league] as const)),
);
const LEAGUE_BY_KEY = new Map(LEAGUES.map((league) => [league.key, league] as const));

/** Pays considérés comme la France pour une adresse (champ libre, facultatif). */
const FRANCE_NAMES = new Set(["", "france", "fr", "fra"]);

/**
 * Département d'une adresse française d'après son code postal, ou `null` (adresse à
 * l'étranger, code postal inconnu). Corse : 200xx-201xx → 2A, 202xx-206xx → 2B.
 * Outre-mer : les trois premiers chiffres (971 à 976).
 */
export function departmentFromPostalCode(
  postalCode: string,
  country: string | null,
): DepartmentCode | null {
  if (country !== null && !FRANCE_NAMES.has(country.trim().toLowerCase())) {
    return null;
  }
  const digits = postalCode.replace(/\s/g, "");
  if (!/^\d{5}$/.test(digits)) {
    return null;
  }
  let code = digits.slice(0, 2);
  if (code === "97" || code === "98") {
    code = digits.slice(0, 3);
  } else if (code === "20") {
    const corsica = Number(digits.slice(2, 3));
    code = corsica <= 1 ? "2A" : corsica <= 6 ? "2B" : "";
  }
  return DEPARTMENT_CODES.has(code) ? code : null;
}

/** Organisme déduit du niveau et du département du match, ou `null` si on ne peut pas le dire. */
export function deducePayer(
  category: PayerCategory,
  department: DepartmentCode | null,
): Payer | null {
  if (category === "National" || category === "Pro") {
    return { kind: "federation" };
  }
  if (department === null) {
    return null;
  }
  if (category === "Departemental") {
    return { kind: "committee", department };
  }
  const league = LEAGUE_BY_DEPARTMENT.get(department);
  return league === undefined ? null : { kind: "league", league: league.key };
}

// ─── Clé stockée en base (`compensation.payer`) ─────────────────────────────

/** Clé stable : `cd-35`, `ligue-bretagne`, `federation`. */
export function payerKey(payer: Payer): string {
  switch (payer.kind) {
    case "committee":
      return `cd-${payer.department}`;
    case "league":
      return `ligue-${payer.league}`;
    case "federation":
      return "federation";
  }
}

/** Organisme d'une clé, ou `null` si la clé est inconnue (valeur forgée, ligue retirée…). */
export function parsePayerKey(key: string): Payer | null {
  if (key === "federation") {
    return { kind: "federation" };
  }
  if (key.startsWith("cd-")) {
    const department = key.slice(3);
    return DEPARTMENT_CODES.has(department) ? { kind: "committee", department } : null;
  }
  if (key.startsWith("ligue-")) {
    const league = key.slice(6);
    return LEAGUE_BY_KEY.has(league) ? { kind: "league", league } : null;
  }
  return null;
}

/** Libellé affiché : « CD35 », « Ligue de Bretagne », « Fédération ». */
export function payerLabel(payer: Payer | null): string {
  if (payer === null) {
    return "Organisme inconnu";
  }
  switch (payer.kind) {
    case "committee":
      return `CD${payer.department}`;
    case "league":
      return LEAGUE_BY_KEY.get(payer.league)?.name ?? "Organisme inconnu";
    case "federation":
      return "Fédération";
  }
}

/**
 * Organisme effectif d'une indemnité : le choix enregistré s'il existe et reste valide,
 * sinon la déduction depuis le niveau et l'adresse du match.
 */
export function effectivePayer(input: {
  override: string | null;
  category: PayerCategory;
  postalCode: string;
  country: string | null;
}): Payer | null {
  if (input.override !== null) {
    const chosen = parsePayerKey(input.override);
    if (chosen !== null) {
      return chosen;
    }
  }
  return deducePayer(input.category, departmentFromPostalCode(input.postalCode, input.country));
}

/** Rang d'affichage : comités, puis ligues, puis Fédération, puis inconnu. */
export function payerRank(payer: Payer | null): number {
  if (payer === null) return 3;
  return payer.kind === "committee" ? 0 : payer.kind === "league" ? 1 : 2;
}
