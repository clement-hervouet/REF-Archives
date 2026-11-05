/**
 * Requêtes SQL des matchs complets (bloc 9) : création depuis une indemnité, officiels,
 * synchronisation avec l'indemnité liée, lecture et suppression.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`, et les jointures le reprennent
 * (on ne lit jamais l'équipe, le club, l'adresse ou la personne d'un autre). Les FK
 * composites l'imposent aussi en base.
 */
import { z } from "zod";
import type { OfficialSlot } from "@/lib/schemas/officials";
import { divisionCategorySchema, divisionLevelSchema, divisionTypeSchema } from "./divisions";
import type { DivisionCategory, DivisionLevel, DivisionType } from "./divisions";
import { personSummaryRowSchema, toPersonSummary } from "./persons";
import type { PersonSummary } from "./persons";
import type { Queryable } from "./users";

/** Limite anti-abus, alignée sur celle des indemnités. */
export const MAX_GAMES_PER_USER = 10_000;

/** Identifiants des personnes à chaque place (`null` = place vide). */
export type OfficialIds = Record<OfficialSlot, string | null>;

export type GameDetail = {
  id: string;
  startsAt: Date;
  division: { category: DivisionCategory; type: DivisionType; level: DivisionLevel };
  team1Name: string;
  team2Name: string;
  address: { street: string; number: string | null; postalCode: string; city: string };
  /** Indemnité active liée, s'il y en a une. */
  compensationId: string | null;
  officials: Record<OfficialSlot, PersonSummary | null>;
};

const nullableIdRowSchema = z.object({ id: z.uuid().nullable() });

function officialParams(officials: OfficialIds): (string | null)[] {
  return [officials.referee1, officials.referee2, officials.referee3, officials.observer];
}

// ─── Création depuis une indemnité ─────────────────────────────────────────

const LOCK_COMPENSATION_FOR_GAME_SQL = `SELECT game_id FROM compensation
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
FOR UPDATE`;

const compensationLinkRowSchema = z.object({ game_id: z.uuid().nullable() });

export type CompensationLink = { found: false } | { found: true; gameId: string | null };

/**
 * Verrouille une indemnité active de l'utilisateur et renvoie son match lié. Le verrou
 * empêche de créer deux matchs pour la même indemnité en parallèle.
 */
export async function lockCompensationLink(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<CompensationLink> {
  const result = await db.query(LOCK_COMPENSATION_FOR_GAME_SQL, [
    input.compensationId,
    input.userId,
  ]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return { found: false };
  }
  return { found: true, gameId: compensationLinkRowSchema.parse(raw).game_id };
}

// Les informations du match sont recopiées depuis l'indemnité, dans la même requête.
// Ne lève jamais d'erreur de limite : id NULL = limite atteinte (ou indemnité introuvable,
// cas déjà écarté par le verrou ci-dessus).
const INSERT_GAME_FROM_COMPENSATION_SQL = `WITH allowed AS (
  SELECT (
    SELECT count(*) FROM game WHERE user_id = $1::uuid AND deleted_at IS NULL
  ) < $7::integer AS ok
),
source AS (
  SELECT starts_at, division_id, address_id, team1_id, team2_id
  FROM compensation
  WHERE id = $2::uuid AND user_id = $1::uuid AND deleted_at IS NULL
),
inserted AS (
  INSERT INTO game (
    user_id, starts_at, division_id, address_id, team1_id, team2_id,
    referee1_id, referee2_id, referee3_id, observer_id
  )
  SELECT $1::uuid, s.starts_at, s.division_id, s.address_id, s.team1_id, s.team2_id,
    $3::uuid, $4::uuid, $5::uuid, $6::uuid
  FROM source s, allowed
  WHERE allowed.ok
  RETURNING id
)
SELECT (SELECT id FROM inserted) AS id`;

const LINK_COMPENSATION_SQL = `UPDATE compensation
SET game_id = $3
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`;

/**
 * Crée un match avec les informations de l'indemnité (date, niveau, équipes, adresse).
 * `null` si l'utilisateur a atteint la limite de matchs.
 */
export async function insertGameFromCompensation(
  db: Queryable,
  input: { userId: string; compensationId: string; officials: OfficialIds },
): Promise<string | null> {
  const result = await db.query(INSERT_GAME_FROM_COMPENSATION_SQL, [
    input.userId,
    input.compensationId,
    ...officialParams(input.officials),
    MAX_GAMES_PER_USER,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
}

/** Lie l'indemnité au match (`compensation.game_id`, §3.8). */
export async function linkCompensationToGame(
  db: Queryable,
  input: { userId: string; compensationId: string; gameId: string },
): Promise<void> {
  await db.query(LINK_COMPENSATION_SQL, [input.compensationId, input.userId, input.gameId]);
}

const FIND_COMPENSATION_FOR_GAME_SQL = `SELECT c.id, c.starts_at, c.game_id,
  club1.name AS team1_name, club2.name AS team2_name
FROM compensation c
JOIN team t1 ON t1.id = c.team1_id AND t1.user_id = c.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = c.user_id
JOIN team t2 ON t2.id = c.team2_id AND t2.user_id = c.user_id
JOIN club club2 ON club2.id = t2.club_id AND club2.user_id = c.user_id
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

// ─── Match sans indemnité et modification de ses informations ───────────────

/** Informations d'un match, déjà résolues (`resolve-match.ts`). */
export type GameInfoRow = {
  startsAt: Date;
  divisionId: string;
  team1Id: string;
  team2Id: string;
  addressId: string;
};

// Ne lève jamais d'erreur de limite : id NULL = limite atteinte.
const INSERT_GAME_SQL = `WITH allowed AS (
  SELECT (
    SELECT count(*) FROM game WHERE user_id = $1::uuid AND deleted_at IS NULL
  ) < $11::integer AS ok
),
inserted AS (
  INSERT INTO game (
    user_id, starts_at, division_id, address_id, team1_id, team2_id,
    referee1_id, referee2_id, referee3_id, observer_id
  )
  SELECT $1::uuid, $2::timestamptz, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
    $7::uuid, $8::uuid, $9::uuid, $10::uuid
  FROM allowed
  WHERE ok
  RETURNING id
)
SELECT (SELECT id FROM inserted) AS id`;

const UPDATE_GAME_INFO_SQL = `UPDATE game
SET starts_at = $3, division_id = $4, address_id = $5, team1_id = $6, team2_id = $7
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`;

// Verrou de l'indemnité AVANT celui du match : même ordre que la modification d'une
// indemnité (indemnité puis match), pour que deux modifications croisées ne s'interbloquent pas.
const LOCK_LINKED_COMPENSATION_SQL = `SELECT c.id, r.scale_id
FROM compensation c
JOIN scale_rate r ON r.id = c.scale_rate_id
WHERE c.game_id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
FOR UPDATE OF c`;

const UPDATE_COMPENSATION_FROM_GAME_SQL = `UPDATE compensation
SET starts_at = $3, division_id = $4, address_id = $5, team1_id = $6, team2_id = $7,
  scale_rate_id = $8
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`;

const linkedCompensationRowSchema = z.object({ id: z.uuid(), scale_id: z.uuid() });

function gameInfoParams(match: GameInfoRow): unknown[] {
  return [match.startsAt, match.divisionId, match.addressId, match.team1Id, match.team2Id];
}

/** Crée un match sans indemnité. `null` si l'utilisateur a atteint la limite de matchs. */
export async function insertGame(
  db: Queryable,
  input: { userId: string; match: GameInfoRow; officials: OfficialIds },
): Promise<string | null> {
  const result = await db.query(INSERT_GAME_SQL, [
    input.userId,
    input.match.startsAt,
    input.match.divisionId,
    input.match.addressId,
    input.match.team1Id,
    input.match.team2Id,
    ...officialParams(input.officials),
    MAX_GAMES_PER_USER,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
}

/** Remplace les informations d'un match actif de l'utilisateur (déjà verrouillé). */
export async function updateGameInfo(
  db: Queryable,
  input: { gameId: string; userId: string; match: GameInfoRow },
): Promise<void> {
  await db.query(UPDATE_GAME_INFO_SQL, [
    input.gameId,
    input.userId,
    ...gameInfoParams(input.match),
  ]);
}

/**
 * Verrouille l'indemnité active liée au match et renvoie son barème (celui de sa ligne
 * actuelle). `null` si le match n'a pas d'indemnité liée.
 */
export async function lockLinkedCompensation(
  db: Queryable,
  input: { gameId: string; userId: string },
): Promise<{ compensationId: string; scaleId: string } | null> {
  const result = await db.query(LOCK_LINKED_COMPENSATION_SQL, [input.gameId, input.userId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = linkedCompensationRowSchema.parse(raw);
  return { compensationId: row.id, scaleId: row.scale_id };
}

/** Recopie les informations du match sur l'indemnité liée, avec la ligne de barème recalculée. */
export async function updateCompensationFromGame(
  db: Queryable,
  input: { compensationId: string; userId: string; match: GameInfoRow; scaleRateId: string },
): Promise<void> {
  await db.query(UPDATE_COMPENSATION_FROM_GAME_SQL, [
    input.compensationId,
    input.userId,
    ...gameInfoParams(input.match),
    input.scaleRateId,
  ]);
}

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

// ─── Officiels et synchronisation ──────────────────────────────────────────

const LOCK_GAME_SQL = `SELECT id FROM game
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
FOR UPDATE`;

const UPDATE_OFFICIALS_SQL = `UPDATE game
SET referee1_id = $3, referee2_id = $4, referee3_id = $5, observer_id = $6
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`;

// Recopie les informations communes de l'indemnité vers son match lié (§3.11). Sans match
// lié (ou match supprimé), la requête ne touche aucune ligne.
const SYNC_GAME_FROM_COMPENSATION_SQL = `UPDATE game g
SET starts_at = c.starts_at, division_id = c.division_id, address_id = c.address_id,
  team1_id = c.team1_id, team2_id = c.team2_id
FROM compensation c
WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
  AND g.id = c.game_id AND g.user_id = c.user_id AND g.deleted_at IS NULL`;

/**
 * Verrouille un match actif de l'utilisateur jusqu'à la fin de la transaction.
 * Faux s'il n'existe pas, est supprimé ou appartient à un autre utilisateur.
 */
export async function lockGame(
  db: Queryable,
  input: { gameId: string; userId: string },
): Promise<boolean> {
  const result = await db.query(LOCK_GAME_SQL, [input.gameId, input.userId]);
  return result.rows.length > 0;
}

/** Remplace les officiels d'un match actif de l'utilisateur (déjà verrouillé). */
export async function updateGameOfficials(
  db: Queryable,
  input: { gameId: string; userId: string; officials: OfficialIds },
): Promise<void> {
  await db.query(UPDATE_OFFICIALS_SQL, [
    input.gameId,
    input.userId,
    ...officialParams(input.officials),
  ]);
}

/** Met le match lié à jour après une modification de l'indemnité (même transaction). */
export async function syncGameFromCompensation(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<void> {
  await db.query(SYNC_GAME_FROM_COMPENSATION_SQL, [input.compensationId, input.userId]);
}

// ─── Suppression ────────────────────────────────────────────────────────────

// Soft delete (§5.6) en une seule requête : le match disparaît et l'indemnité liée, qui
// porte ses propres informations, est seulement détachée.
const SOFT_DELETE_GAME_SQL = `WITH deleted AS (
  UPDATE game SET deleted_at = now()
  WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
  RETURNING id
),
unlinked AS (
  UPDATE compensation SET game_id = NULL
  WHERE user_id = $2 AND game_id IN (SELECT id FROM deleted)
)
SELECT id FROM deleted`;

/** Supprime (soft delete) un match actif de l'utilisateur. Faux si introuvable. */
export async function softDeleteGame(
  db: Queryable,
  input: { gameId: string; userId: string },
): Promise<boolean> {
  const result = await db.query(SOFT_DELETE_GAME_SQL, [input.gameId, input.userId]);
  return result.rows.length > 0;
}

// ─── Lecture ────────────────────────────────────────────────────────────────

/** Personne à une place, en JSON (NULL si la place est vide). Alias fixes, jamais saisis. */
function personJson(alias: string): string {
  return `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE json_build_object(
    'id', ${alias}.id, 'is_self', ${alias}.is_self, 'firstname', ${alias}.firstname,
    'lastname', ${alias}.lastname, 'has_account', ${alias}.has_account) END`;
}

const FIND_GAME_SQL = `SELECT g.id, g.starts_at, d.division, d.type, d.level,
  club1.name AS team1_name, club2.name AS team2_name,
  a.street, a.number, a.postal_code, a.city,
  c.id AS compensation_id,
  ${personJson("r1")} AS referee1,
  ${personJson("r2")} AS referee2,
  ${personJson("r3")} AS referee3,
  ${personJson("o")} AS observer
FROM game g
JOIN division d ON d.id = g.division_id
JOIN team t1 ON t1.id = g.team1_id AND t1.user_id = g.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = g.user_id
JOIN team t2 ON t2.id = g.team2_id AND t2.user_id = g.user_id
JOIN club club2 ON club2.id = t2.club_id AND club2.user_id = g.user_id
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
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  team1_name: z.string(),
  team2_name: z.string(),
  street: z.string(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string(),
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
    division: { category: row.division, type: row.type, level: row.level },
    team1Name: row.team1_name,
    team2Name: row.team2_name,
    address: {
      street: row.street,
      number: row.number,
      postalCode: row.postal_code,
      city: row.city,
    },
    compensationId: row.compensation_id,
    officials: {
      referee1: toOfficial(row.referee1),
      referee2: toOfficial(row.referee2),
      referee3: toOfficial(row.referee3),
      observer: toOfficial(row.observer),
    },
  };
}
