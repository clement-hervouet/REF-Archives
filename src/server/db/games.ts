/**
 * Lecture des matchs complets (bloc 9) : fiche d'un match avec ses officiels, indemnité vue
 * depuis « Compléter le match », et valeurs pour préremplir le formulaire d'informations.
 * Les écritures sont dans `game-writes.ts`.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`, et les jointures le reprennent
 * (on ne lit jamais l'équipe, le club, l'adresse ou la personne d'un autre).
 */
import { z } from "zod";
import type { OfficialSlot } from "@/lib/schemas/officials";
import {
  MATCH_ADDRESS_COLUMNS,
  MATCH_PARTIES_COLUMNS,
  matchAddressFields,
  matchPartiesFields,
  matchTeamJoins,
  toMatchAddress,
  toMatchParties,
} from "./match-info";
import type { MatchAddress, MatchDivision } from "./match-info";
import { personSummaryRowSchema, toPersonSummary } from "./persons";
import type { PersonSummary } from "./persons";
import type { Queryable } from "./users";

export type GameDetail = {
  id: string;
  startsAt: Date;
  division: MatchDivision;
  team1Name: string;
  team2Name: string;
  address: MatchAddress;
  /** Indemnité active liée, s'il y en a une. */
  compensationId: string | null;
  officials: Record<OfficialSlot, PersonSummary | null>;
};

// ─── Indemnité vue depuis « Compléter le match » ────────────────────────────

const FIND_COMPENSATION_FOR_GAME_SQL = `SELECT c.id, c.starts_at, c.game_id,
  club1.name AS team1_name, club2.name AS team2_name
FROM compensation c
${matchTeamJoins("c")}
WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL`;

const compensationForGameRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  game_id: z.uuid().nullable(),
  team1_name: z.string(),
  team2_name: z.string(),
});

/** Indemnité vue depuis la page « Compléter le match ». */
export type CompensationForGame = {
  id: string;
  startsAt: Date;
  gameId: string | null;
  team1Name: string;
  team2Name: string;
};

/** Indemnité active de l'utilisateur et son match lié ; `null` si introuvable ou supprimée. */
export async function findCompensationForGame(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<CompensationForGame | null> {
  const result = await db.query(FIND_COMPENSATION_FOR_GAME_SQL, [
    input.compensationId,
    input.userId,
  ]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = compensationForGameRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    gameId: row.game_id,
    team1Name: row.team1_name,
    team2Name: row.team2_name,
  };
}

// ─── Valeurs pour modifier les informations d'un match ──────────────────────

const FIND_GAME_FOR_EDIT_SQL = `SELECT g.id, g.starts_at, g.division_id, g.address_id,
  t1.club_id AS team1_club_id, t2.club_id AS team2_club_id,
  club1.address_id AS team1_address_id, c.id AS compensation_id
FROM game g
JOIN team t1 ON t1.id = g.team1_id AND t1.user_id = g.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = g.user_id
JOIN team t2 ON t2.id = g.team2_id AND t2.user_id = g.user_id
LEFT JOIN compensation c ON c.game_id = g.id AND c.user_id = g.user_id AND c.deleted_at IS NULL
WHERE g.id = $1 AND g.user_id = $2 AND g.deleted_at IS NULL`;

const gameForEditRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  division_id: z.uuid(),
  address_id: z.uuid(),
  team1_club_id: z.uuid(),
  team2_club_id: z.uuid(),
  team1_address_id: z.uuid(),
  compensation_id: z.uuid().nullable(),
});

/** Valeurs d'un match pour préremplir le formulaire de ses informations. */
export type GameForEdit = {
  id: string;
  startsAt: Date;
  divisionId: string;
  team1ClubId: string;
  team2ClubId: string;
  addressId: string;
  /** Adresse du club de l'équipe 1 : si c'est celle du match, pas d'« exception ». */
  team1AddressId: string;
  /** Indemnité active liée, mise à jour avec le match. */
  compensationId: string | null;
};

/** Match actif de l'utilisateur, pour modifier ses informations ; `null` sinon. */
export async function findGameForEdit(
  db: Queryable,
  input: { gameId: string; userId: string },
): Promise<GameForEdit | null> {
  const result = await db.query(FIND_GAME_FOR_EDIT_SQL, [input.gameId, input.userId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = gameForEditRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    divisionId: row.division_id,
    team1ClubId: row.team1_club_id,
    team2ClubId: row.team2_club_id,
    addressId: row.address_id,
    team1AddressId: row.team1_address_id,
    compensationId: row.compensation_id,
  };
}

// ─── Fiche du match avec ses officiels ──────────────────────────────────────

/** Personne à une place, en JSON (NULL si la place est vide). Alias fixes, jamais saisis. */
function personJson(alias: string): string {
  return `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object(
    'id', ${alias}.id, 'is_self', ${alias}.is_self, 'firstname', ${alias}.firstname,
    'lastname', ${alias}.lastname, 'has_account', ${alias}.has_account) END`;
}

const FIND_GAME_SQL = `SELECT g.id, g.starts_at, ${MATCH_PARTIES_COLUMNS},
  ${MATCH_ADDRESS_COLUMNS},
  c.id AS compensation_id,
  ${personJson("r1")} AS referee1,
  ${personJson("r2")} AS referee2,
  ${personJson("r3")} AS referee3,
  ${personJson("o")} AS observer
FROM game g
JOIN division d ON d.id = g.division_id
${matchTeamJoins("g")}
JOIN address a ON a.id = g.address_id AND a.user_id = g.user_id
LEFT JOIN person r1 ON r1.id = g.referee1_id AND r1.user_id = g.user_id
LEFT JOIN person r2 ON r2.id = g.referee2_id AND r2.user_id = g.user_id
LEFT JOIN person r3 ON r3.id = g.referee3_id AND r3.user_id = g.user_id
LEFT JOIN person o ON o.id = g.observer_id AND o.user_id = g.user_id
LEFT JOIN compensation c ON c.game_id = g.id AND c.user_id = g.user_id AND c.deleted_at IS NULL
WHERE g.id = $1 AND g.user_id = $2 AND g.deleted_at IS NULL`;

const officialSchema = personSummaryRowSchema.nullable();

const gameRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  ...matchPartiesFields,
  ...matchAddressFields,
  compensation_id: z.uuid().nullable(),
  referee1: officialSchema,
  referee2: officialSchema,
  referee3: officialSchema,
  observer: officialSchema,
});

function toOfficial(row: z.infer<typeof officialSchema>): PersonSummary | null {
  return row === null ? null : toPersonSummary(row);
}

/** Match actif de l'utilisateur avec ses officiels ; `null` si introuvable ou supprimé. */
export async function findGame(
  db: Queryable,
  input: { gameId: string; userId: string },
): Promise<GameDetail | null> {
  const result = await db.query(FIND_GAME_SQL, [input.gameId, input.userId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = gameRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    ...toMatchParties(row),
    address: toMatchAddress(row),
    compensationId: row.compensation_id,
    officials: {
      referee1: toOfficial(row.referee1),
      referee2: toOfficial(row.referee2),
      referee3: toOfficial(row.referee3),
      observer: toOfficial(row.observer),
    },
  };
}
