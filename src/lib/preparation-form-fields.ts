/**
 * Constantes de la préparation de match (§15.4.10), partagées par le client (formulaire) et
 * le serveur (schéma, lecture du FormData, requêtes). Sans dépendance : ni Zod ni code
 * serveur n'est embarqué dans le bundle client.
 */

/** Les deux équipes du match, dans l'ordre du match. */
export const PREPARATION_TEAMS = ["team1", "team2"] as const;
export type PreparationTeam = (typeof PREPARATION_TEAMS)[number];

/** Nombre d'équipes de la poule : un seul champ, les deux équipes sont dans la même poule. */
export const TEAM_COUNT_FIELD = "teamCount";

/** Nombres du classement d'une équipe, dans l'ordre d'affichage. */
export const TEAM_NUMBER_PARTS = ["Rank", "Wins", "Losses"] as const;
export type TeamNumberPart = (typeof TEAM_NUMBER_PARTS)[number];

/** Textes d'une équipe : notes sur les joueurs, notes sur les coachs. */
export const TEAM_TEXT_PARTS = ["Players", "Coaches"] as const;
export type TeamTextPart = (typeof TEAM_TEXT_PARTS)[number];

/** Case « déjà arbitrée cette saison » d'une équipe. */
export const TEAM_REFEREED_PART = "AlreadyRefereed";

/** Textes du trio arbitral, dans l'ordre d'affichage. */
export const CREW_FIELDS = [
  "placement",
  "communication",
  "management",
  "table",
  "contact",
] as const;
export type CrewField = (typeof CREW_FIELDS)[number];

/** Case « observé » (pré-cochée si un observateur est saisi sur le match). */
export const OBSERVED_FIELD = "observed";

/** Nom d'un champ d'équipe : `team1Rank`, `team2Players`, `team1AlreadyRefereed`… */
export function teamFieldName(
  team: PreparationTeam,
  part: TeamNumberPart | TeamTextPart | typeof TEAM_REFEREED_PART,
): `${PreparationTeam}${TeamNumberPart | TeamTextPart | typeof TEAM_REFEREED_PART}` {
  return `${team}${part}`;
}

/** Tous les champs du formulaire (noms HTML), dans l'ordre d'affichage. */
export const PREPARATION_FIELDS: readonly string[] = [
  TEAM_COUNT_FIELD,
  ...PREPARATION_TEAMS.flatMap((team) =>
    ([...TEAM_NUMBER_PARTS, TEAM_REFEREED_PART, ...TEAM_TEXT_PARTS] as const).map((part) =>
      teamFieldName(team, part),
    ),
  ),
  ...CREW_FIELDS,
  OBSERVED_FIELD,
];

/**
 * Champ caché qui porte la valeur de départ d'un champ (`base.team1Rank`) : le serveur
 * compare valeur de départ, valeur saisie et valeur enregistrée pour n'écrire que les
 * champs modifiés et repérer ceux changés ailleurs entre-temps.
 */
export function baseFieldName(name: string): string {
  return `base.${name}`;
}

/** Valeur envoyée par une case cochée. */
export const CHECKBOX_ON = "1";

/** Bornes alignées sur la migration 031 (`game_preparation`). */
export const PREPARATION_TEXT_MAX = 4096;
export const TEAM_COUNT_MIN = 2;
export const TEAM_COUNT_MAX = 50;
export const RECORD_MAX = 99;
