/**
 * Requêtes SQL des préparations de match (§15.4.10) : au plus une préparation active par
 * match (index `game_preparation_one_active_per_game_key`), jamais pour un plateau.
 *
 * Chaque requête filtre sur `user_id`, jointures comprises (§6.2). Les filtres de la liste
 * sont des paramètres liés, jamais concaténés (§3.2).
 */
import { z } from "zod";
import type { GameNotesFilters } from "@/lib/schemas/game-notes-filters";
import type { PreparationForm, TeamPreparation } from "@/lib/schemas/preparations";
import {
  MATCH_CLUBS_COLUMNS,
  matchClubsFields,
  matchPartiesColumns,
  matchPartiesFields,
  matchTeamJoins,
  toMatchClubs,
  toMatchParties,
} from "./match-info";
import type { MatchClubs, MatchDivision } from "./match-info";
import { VALID_SHARE } from "./share-access";
import type { Queryable } from "./users";

export type Preparation = PreparationForm & {
  id: string;
  updatedAt: Date;
  /** Auteur de la dernière modification (le propriétaire ou un destinataire du partage). */
  updatedBy: string | null;
};

// ─── Écriture ───────────────────────────────────────────────────────────────

// Verrouille le match et dit s'il s'agit d'un plateau (pas d'équipe 2, §15.4.7).
const LOCK_GAME_FOR_PREPARATION_SQL = `SELECT team2_id IS NULL AS plateau FROM game
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
FOR UPDATE`;

const lockRowSchema = z.object({ plateau: z.boolean() });

// Crée la préparation du match ou remplace celle qui existe. La cible du ON CONFLICT
// reprend l'index partiel : une préparation supprimée n'empêche pas d'en écrire une neuve.
const UPSERT_PREPARATION_SQL = `INSERT INTO game_preparation (user_id, game_id, team_count,
  team1_rank, team1_wins, team1_losses, team1_players, team1_coaches, team1_already_refereed,
  team2_rank, team2_wins, team2_losses, team2_players, team2_coaches, team2_already_refereed,
  crew_placement, crew_communication, crew_management, crew_table, crew_contact, observed,
  updated_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
  $19, $20, $21, $22)
ON CONFLICT (game_id) WHERE deleted_at IS NULL
DO UPDATE SET
  team_count = EXCLUDED.team_count,
  team1_rank = EXCLUDED.team1_rank, team1_wins = EXCLUDED.team1_wins, team1_losses = EXCLUDED.team1_losses,
  team1_players = EXCLUDED.team1_players, team1_coaches = EXCLUDED.team1_coaches,
  team1_already_refereed = EXCLUDED.team1_already_refereed,
  team2_rank = EXCLUDED.team2_rank, team2_wins = EXCLUDED.team2_wins, team2_losses = EXCLUDED.team2_losses,
  team2_players = EXCLUDED.team2_players, team2_coaches = EXCLUDED.team2_coaches,
  team2_already_refereed = EXCLUDED.team2_already_refereed,
  crew_placement = EXCLUDED.crew_placement, crew_communication = EXCLUDED.crew_communication,
  crew_management = EXCLUDED.crew_management, crew_table = EXCLUDED.crew_table,
  crew_contact = EXCLUDED.crew_contact, observed = EXCLUDED.observed,
  updated_by = EXCLUDED.updated_by`;

const SOFT_DELETE_PREPARATION_SQL = `UPDATE game_preparation SET deleted_at = now()
WHERE game_id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING id`;

/**
 * Verrouille un match actif de l'utilisateur pour écrire sa préparation : `null` s'il est
 * introuvable, supprimé ou à un autre, sinon s'il s'agit d'un plateau.
 */
export async function lockGameForPreparation(
  db: Queryable,
  input: { gameId: string; userId: string },
): Promise<{ plateau: boolean } | null> {
  const result = await db.query(LOCK_GAME_FOR_PREPARATION_SQL, [input.gameId, input.userId]);
  const raw = result.rows[0];
  return raw === undefined ? null : lockRowSchema.parse(raw);
}

function teamValues(team: TeamPreparation): unknown[] {
  return [team.rank, team.wins, team.losses, team.players, team.coaches, team.alreadyRefereed];
}

/**
 * Écrit la préparation d'un match de l'utilisateur (`updatedBy` : auteur de la
 * modification). Le match doit être actif, à l'utilisateur, hors plateau et verrouillé
 * dans la même transaction.
 */
export async function savePreparation(
  db: Queryable,
  input: { userId: string; gameId: string; updatedBy: string; preparation: PreparationForm },
): Promise<void> {
  const { crew, teamCount, team1, team2, observed } = input.preparation;
  await db.query(UPSERT_PREPARATION_SQL, [
    input.userId,
    input.gameId,
    teamCount,
    ...teamValues(team1),
    ...teamValues(team2),
    crew.placement,
    crew.communication,
    crew.management,
    crew.table,
    crew.contact,
    observed,
    input.updatedBy,
  ]);
}

/** Supprime (soft delete) la préparation d'un match de l'utilisateur. Faux s'il n'y en a pas. */
export async function softDeletePreparation(
  db: Queryable,
  input: { userId: string; gameId: string },
): Promise<boolean> {
  const result = await db.query(SOFT_DELETE_PREPARATION_SQL, [input.gameId, input.userId]);
  return result.rows.length > 0;
}

// ─── Lecture ────────────────────────────────────────────────────────────────

/** Colonnes d'une préparation (alias `p`), lues par `toPreparation`. */
export const PREPARATION_COLUMNS = `p.id, p.updated_at, p.updated_by, p.team_count,
  p.team1_rank, p.team1_wins, p.team1_losses, p.team1_players, p.team1_coaches,
  p.team1_already_refereed,
  p.team2_rank, p.team2_wins, p.team2_losses, p.team2_players, p.team2_coaches,
  p.team2_already_refereed,
  p.crew_placement, p.crew_communication, p.crew_management, p.crew_table, p.crew_contact,
  p.observed`;

const FIND_PREPARATION_SQL = `SELECT ${PREPARATION_COLUMNS}
FROM game_preparation p
WHERE p.game_id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`;

const smallint = z.number().int().nullable();
const text = z.string().nullable();

const preparationRowSchema = z.object({
  id: z.uuid(),
  updated_at: z.date(),
  updated_by: z.uuid().nullable(),
  team_count: smallint,
  team1_rank: smallint,
  team1_wins: smallint,
  team1_losses: smallint,
  team1_players: text,
  team1_coaches: text,
  team1_already_refereed: z.boolean(),
  team2_rank: smallint,
  team2_wins: smallint,
  team2_losses: smallint,
  team2_players: text,
  team2_coaches: text,
  team2_already_refereed: z.boolean(),
  crew_placement: text,
  crew_communication: text,
  crew_management: text,
  crew_table: text,
  crew_contact: text,
  observed: z.boolean(),
});

type PreparationRow = z.output<typeof preparationRowSchema>;

function toTeam(row: PreparationRow, team: "team1" | "team2"): TeamPreparation {
  return {
    rank: row[`${team}_rank`],
    wins: row[`${team}_wins`],
    losses: row[`${team}_losses`],
    players: row[`${team}_players`],
    coaches: row[`${team}_coaches`],
    alreadyRefereed: row[`${team}_already_refereed`],
  };
}

/** Préparation lue avec `PREPARATION_COLUMNS`. */
export function toPreparation(raw: unknown): Preparation {
  const row = preparationRowSchema.parse(raw);
  return {
    id: row.id,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    teamCount: row.team_count,
    team1: toTeam(row, "team1"),
    team2: toTeam(row, "team2"),
    crew: {
      placement: row.crew_placement,
      communication: row.crew_communication,
      management: row.crew_management,
      table: row.crew_table,
      contact: row.crew_contact,
    },
    observed: row.observed,
  };
}

/** Préparation active d'un match de l'utilisateur ; `null` s'il n'y en a pas. */
export async function findPreparation(
  db: Queryable,
  input: { userId: string; gameId: string },
): Promise<Preparation | null> {
  const result = await db.query(FIND_PREPARATION_SQL, [input.gameId, input.userId]);
  const raw = result.rows[0];
  return raw === undefined ? null : toPreparation(raw);
}

// ─── « Déjà arbitrée cette saison » ─────────────────────────────────────────

// Matchs précédents de la saison, au même niveau que le match préparé : les indemnités
// actives et les matchs complets actifs, datés de `$3` (début de la saison) jusqu'au match
// exclu. Une indemnité et son match lié peuvent figurer deux fois : sans effet sur EXISTS.
// Une équipe est « déjà arbitrée » si l'une des deux équipes d'un de ces matchs est de son
// club. Toutes les jointures reprennent l'utilisateur.
const FIND_ALREADY_REFEREED_SQL = `WITH target AS (
  SELECT g.id, g.starts_at, g.division_id, t1.club_id AS club1_id, t2.club_id AS club2_id
  FROM game g
  JOIN team t1 ON t1.id = g.team1_id AND t1.user_id = g.user_id
  JOIN team t2 ON t2.id = g.team2_id AND t2.user_id = g.user_id
  WHERE g.id = $1 AND g.user_id = $2 AND g.deleted_at IS NULL
),
previous AS (
  SELECT c.team1_id, c.team2_id
  FROM compensation c, target
  WHERE c.user_id = $2 AND c.deleted_at IS NULL AND c.division_id = target.division_id
    AND c.starts_at >= $3 AND c.starts_at < target.starts_at
    AND c.game_id IS DISTINCT FROM target.id
  UNION ALL
  SELECT g.team1_id, g.team2_id
  FROM game g, target
  WHERE g.user_id = $2 AND g.deleted_at IS NULL AND g.id <> target.id
    AND g.division_id = target.division_id
    AND g.starts_at >= $3 AND g.starts_at < target.starts_at
),
previous_clubs AS (
  SELECT DISTINCT t.club_id
  FROM previous p
  JOIN team t ON t.user_id = $2 AND (t.id = p.team1_id OR t.id = p.team2_id)
)
SELECT
  EXISTS (SELECT 1 FROM previous_clubs pc WHERE pc.club_id = target.club1_id) AS team1,
  EXISTS (SELECT 1 FROM previous_clubs pc WHERE pc.club_id = target.club2_id) AS team2
FROM target`;

const alreadyRefereedRowSchema = z.object({ team1: z.boolean(), team2: z.boolean() });

/**
 * Pour chaque équipe d'un match de l'utilisateur : vrai si un match précédent de la même
 * saison (à partir de `seasonFrom`), au même niveau, opposait déjà une équipe de son club.
 * `null` si le match est introuvable ou si c'est un plateau.
 */
export async function findAlreadyRefereed(
  db: Queryable,
  input: { userId: string; gameId: string; seasonFrom: Date },
): Promise<{ team1: boolean; team2: boolean } | null> {
  const result = await db.query(FIND_ALREADY_REFEREED_SQL, [
    input.gameId,
    input.userId,
    input.seasonFrom,
  ]);
  const raw = result.rows[0];
  return raw === undefined ? null : alreadyRefereedRowSchema.parse(raw);
}

// ─── Liste (page « Préparation de match ») ──────────────────────────────────

/** Préparations par page. */
const PREPARATIONS_PAGE_SIZE = 30;

/** Classement d'une équipe dans la liste. */
type TeamStanding = {
  rank: number | null;
  wins: number | null;
  losses: number | null;
  alreadyRefereed: boolean;
};

export type PreparationListItem = MatchClubs & {
  gameId: string;
  startsAt: Date;
  division: MatchDivision;
  team1Name: string;
  team2Name: string | null;
  /** Nombre d'équipes de la poule, commun aux deux équipes. */
  teamCount: number | null;
  team1: TeamStanding;
  team2: TeamStanding;
  observed: boolean;
  /** Préparation partagée avec au moins un arbitre (partage valide). */
  shared: boolean;
  /** Propriétaire, pour une préparation partagée avec l'utilisateur ; `null` pour la sienne. */
  sharedBy: { firstname: string | null; lastname: string | null } | null;
};

export type PreparationsPage = { items: PreparationListItem[]; hasMore: boolean };

// Mêmes filtres que « Notes de match » (énumérations comparées en texte, paramètres liés).
// LIMIT + 1 : la ligne en trop indique seulement qu'une page suivante existe.
const LIST_PREPARATIONS_SQL = `SELECT g.id, g.starts_at, ${matchPartiesColumns("g")},
  ${MATCH_CLUBS_COLUMNS},
  p.team_count,
  p.team1_rank, p.team1_wins, p.team1_losses, p.team1_already_refereed,
  p.team2_rank, p.team2_wins, p.team2_losses, p.team2_already_refereed,
  p.observed,
  EXISTS (SELECT 1 FROM game_share s, colleague_link l WHERE ${VALID_SHARE}) AS shared
FROM game_preparation p
JOIN game g ON g.id = p.game_id AND g.user_id = p.user_id AND g.deleted_at IS NULL
JOIN division d ON d.id = g.division_id
${matchTeamJoins("g")}
WHERE p.user_id = $1 AND p.deleted_at IS NULL
  AND ($2::text IS NULL OR d.division::text = $2::text)
  AND ($3::text IS NULL OR d.type::text = $3::text)
  AND ($4::uuid IS NULL OR club1.id = $4::uuid OR club2.id = $4::uuid)
  AND ($5::text IS NULL OR d.level::text = $5::text)
ORDER BY g.starts_at DESC, g.id
LIMIT $6::integer OFFSET $7::integer`;

const listRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  ...matchPartiesFields,
  ...matchClubsFields,
  team_count: smallint,
  team1_rank: smallint,
  team1_wins: smallint,
  team1_losses: smallint,
  team1_already_refereed: z.boolean(),
  team2_rank: smallint,
  team2_wins: smallint,
  team2_losses: smallint,
  team2_already_refereed: z.boolean(),
  observed: z.boolean(),
  shared: z.boolean(),
});

type ListRow = z.output<typeof listRowSchema>;

function toStanding(row: ListRow, team: "team1" | "team2"): TeamStanding {
  return {
    rank: row[`${team}_rank`],
    wins: row[`${team}_wins`],
    losses: row[`${team}_losses`],
    alreadyRefereed: row[`${team}_already_refereed`],
  };
}

/** Préparations actives de l'utilisateur (matchs actifs), du match le plus récent au plus ancien. */
export async function listPreparations(
  db: Queryable,
  input: { userId: string; filters: GameNotesFilters },
): Promise<PreparationsPage> {
  const { filters } = input;
  const result = await db.query(LIST_PREPARATIONS_SQL, [
    input.userId,
    filters.category,
    filters.type,
    filters.clubId,
    filters.level,
    PREPARATIONS_PAGE_SIZE + 1,
    (filters.page - 1) * PREPARATIONS_PAGE_SIZE,
  ]);
  const rows = result.rows.map((raw) => listRowSchema.parse(raw));
  return {
    hasMore: rows.length > PREPARATIONS_PAGE_SIZE,
    items: rows.slice(0, PREPARATIONS_PAGE_SIZE).map((row) => ({
      gameId: row.id,
      startsAt: row.starts_at,
      ...toMatchParties(row),
      ...toMatchClubs(row),
      teamCount: row.team_count,
      team1: toStanding(row, "team1"),
      team2: toStanding(row, "team2"),
      observed: row.observed,
      shared: row.shared,
      sharedBy: null,
    })),
  };
}
