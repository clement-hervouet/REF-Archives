/**
 * Écritures des matchs complets (bloc 9) : création (depuis une indemnité ou seule),
 * modification des informations et des officiels, synchronisation avec l'indemnité liée et
 * suppression. Chaque fonction exécute une seule requête ; les services les orchestrent en
 * transaction. La lecture est dans `games.ts`.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`, et les jointures le reprennent.
 */
import { z } from "zod";
import type { OfficialSlot } from "@/lib/schemas/officials";
import type { Queryable } from "./users";

/** Limite anti-abus, alignée sur celle des indemnités. */
export const MAX_GAMES_PER_USER = 10_000;

/** Identifiants des personnes à chaque place (`null` = place vide). */
export type OfficialIds = Record<OfficialSlot, string | null>;

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
