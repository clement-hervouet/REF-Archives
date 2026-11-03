/**
 * Requêtes SQL sur les barèmes : `scale`, `scale_rate` et `level_default_scale` (§3.7).
 *
 * Propriété : le barème commun n'a pas de propriétaire (`user_id` NULL). Chaque requête
 * reçoit donc un `ScaleOwner` explicite et compare avec `IS NOT DISTINCT FROM`, qui
 * traite NULL comme une valeur. Le propriétaire « commun » ne doit être passé qu'après
 * `requireAdmin` : c'est l'appelant qui en est responsable.
 */
import { z } from "zod";
import type { Queryable } from "./users";

/** Limites anti-abus (application potentiellement publique). */
export const MAX_SCALES_PER_USER = 50;
export const MAX_RATES_PER_SCALE = 200;

const PG_UNIQUE_VIOLATION = "23505";

/** À qui appartient un barème : un utilisateur, ou personne (barème commun). */
export type ScaleOwner = { kind: "user"; userId: string } | { kind: "common" };

export type ScaleRate = {
  id: string;
  /** Date d'application `AAAA-MM-JJ` (Europe/Paris). */
  effectiveFrom: string;
  gameAmountCents: number;
  /** Centimes par km, chaîne `numeric` exacte (ex. `"40.00"`). */
  centsPerKm: string;
  /** Référencée par au moins une indemnité : elle ne peut plus être supprimée. */
  inUse: boolean;
};

export type ManagedScale = {
  id: string;
  name: string;
  isCommon: boolean;
  /** Lignes de la plus récente à la plus ancienne. */
  rates: ScaleRate[];
};

export type SelectableScale = {
  id: string;
  name: string;
  isCommon: boolean;
};

export type LevelDefaultRow = {
  divisionId: string;
  scaleId: string;
};

/** Paramètre SQL du propriétaire : NULL pour le barème commun. */
function ownerParam(owner: ScaleOwner): string | null {
  return owner.kind === "user" ? owner.userId : null;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === PG_UNIQUE_VIOLATION &&
    "constraint" in error &&
    error.constraint === constraint
  );
}

// ─── Lecture ────────────────────────────────────────────────────────────────

const scaleRowSchema = z.object({ id: z.uuid(), name: z.string(), is_common: z.boolean() });

const rateRowSchema = z.object({
  id: z.uuid(),
  scale_id: z.uuid(),
  effective_from: z.string(),
  game_amount_cents: z.number().int(),
  cents_per_km: z.string(),
  in_use: z.boolean(),
});

const idRowSchema = z.object({ id: z.uuid() });

const FIND_COMMON_SQL = `SELECT id FROM scale WHERE user_id IS NULL`;

const LIST_OWNED_SCALES_SQL = `SELECT id, name, user_id IS NULL AS is_common
FROM scale
WHERE user_id IS NOT DISTINCT FROM $1::uuid AND deleted_at IS NULL
ORDER BY lower(name)`;

// effective_from et cents_per_km en texte : pas de conversion de fuseau ni de float.
const LIST_OWNED_RATES_SQL = `SELECT r.id, r.scale_id, r.effective_from::text AS effective_from,
  r.game_amount_cents, r.cents_per_km::text AS cents_per_km,
  EXISTS (SELECT 1 FROM compensation c WHERE c.scale_rate_id = r.id) AS in_use
FROM scale_rate r
JOIN scale s ON s.id = r.scale_id
WHERE s.user_id IS NOT DISTINCT FROM $1::uuid AND s.deleted_at IS NULL
ORDER BY r.effective_from DESC`;

// Les barèmes de l'utilisateur et le barème commun : ce qu'il peut choisir.
const LIST_SELECTABLE_SQL = `SELECT id, name, user_id IS NULL AS is_common
FROM scale
WHERE (user_id = $1 OR user_id IS NULL) AND deleted_at IS NULL
ORDER BY (user_id IS NULL) DESC, lower(name)`;

const LIST_LEVEL_DEFAULTS_SQL = `SELECT division_id, scale_id
FROM level_default_scale
WHERE user_id = $1`;

/** Identifiant du barème commun (créé par la migration 009). */
export async function findCommonScaleId(db: Queryable): Promise<string> {
  const result = await db.query(FIND_COMMON_SQL, []);
  return idRowSchema.parse(result.rows[0]).id;
}

/**
 * Barèmes d'un propriétaire avec toutes leurs lignes, pour la page de gestion.
 * `inUse` n'est calculé que sur des lignes du propriétaire : rien ne fuit sur les autres.
 */
export async function listOwnedScales(db: Queryable, owner: ScaleOwner): Promise<ManagedScale[]> {
  const [scales, rates] = await Promise.all([
    db.query(LIST_OWNED_SCALES_SQL, [ownerParam(owner)]),
    db.query(LIST_OWNED_RATES_SQL, [ownerParam(owner)]),
  ]);
  const byScale = new Map<string, ScaleRate[]>();
  for (const raw of rates.rows) {
    const row = rateRowSchema.parse(raw);
    const list = byScale.get(row.scale_id) ?? [];
    list.push({
      id: row.id,
      effectiveFrom: row.effective_from,
      gameAmountCents: row.game_amount_cents,
      centsPerKm: row.cents_per_km,
      inUse: row.in_use,
    });
    byScale.set(row.scale_id, list);
  }
  return scales.rows.map((raw) => {
    const row = scaleRowSchema.parse(raw);
    return {
      id: row.id,
      name: row.name,
      isCommon: row.is_common,
      rates: byScale.get(row.id) ?? [],
    };
  });
}

/** Barèmes que l'utilisateur peut choisir : le commun en premier, puis les siens. */
export async function listSelectableScales(
  db: Queryable,
  userId: string,
): Promise<SelectableScale[]> {
  const result = await db.query(LIST_SELECTABLE_SQL, [userId]);
  return result.rows.map((raw) => {
    const row = scaleRowSchema.parse(raw);
    return { id: row.id, name: row.name, isCommon: row.is_common };
  });
}

const levelDefaultRowSchema = z.object({ division_id: z.uuid(), scale_id: z.uuid() });

/** Barèmes par défaut choisis par l'utilisateur, niveau par niveau. */
export async function listLevelDefaults(db: Queryable, userId: string): Promise<LevelDefaultRow[]> {
  const result = await db.query(LIST_LEVEL_DEFAULTS_SQL, [userId]);
  return result.rows.map((raw) => {
    const row = levelDefaultRowSchema.parse(raw);
    return { divisionId: row.division_id, scaleId: row.scale_id };
  });
}

// ─── Barèmes ────────────────────────────────────────────────────────────────

// Ne lève jamais d'erreur d'unicité (ON CONFLICT … DO NOTHING) : la requête peut donc
// s'exécuter dans une transaction sans l'interrompre. allowed = sous la limite ;
// id NULL alors qu'allowed = nom déjà pris.
const INSERT_SCALE_SQL = `WITH allowed AS (
  SELECT (SELECT count(*) FROM scale WHERE user_id = $1::uuid AND deleted_at IS NULL) < $3::integer AS ok
),
inserted AS (
  INSERT INTO scale (user_id, name)
  SELECT $1::uuid, $2::text FROM allowed WHERE ok
  ON CONFLICT (user_id, lower(name)) WHERE user_id IS NOT NULL AND deleted_at IS NULL DO NOTHING
  RETURNING id
)
SELECT (SELECT ok FROM allowed) AS allowed, (SELECT id FROM inserted) AS id`;

const RENAME_SCALE_SQL = `UPDATE scale
SET name = $3
WHERE id = $1 AND user_id IS NOT DISTINCT FROM $2::uuid AND deleted_at IS NULL
RETURNING id`;

const LOCK_USER_SCALE_SQL = `SELECT s.id,
  EXISTS (
    SELECT 1 FROM compensation c JOIN scale_rate r ON r.id = c.scale_rate_id WHERE r.scale_id = s.id
  ) AS in_use
FROM scale s
WHERE s.id = $1 AND s.user_id = $2 AND s.deleted_at IS NULL
FOR UPDATE`;

const ARCHIVE_SCALE_SQL = `UPDATE scale SET deleted_at = now() WHERE id = $1`;
const DELETE_DEFAULTS_OF_SCALE_SQL = `DELETE FROM level_default_scale WHERE scale_id = $1`;
const DELETE_SCALE_SQL = `DELETE FROM scale WHERE id = $1`;

export type CreateScaleResult =
  { status: "created"; scaleId: string } | { status: "name_taken" } | { status: "limit_reached" };

const insertScaleRowSchema = z.object({ allowed: z.boolean(), id: z.uuid().nullable() });

/** Crée un barème personnel. Le barème commun, lui, existe déjà (migration 009). */
export async function insertScale(
  db: Queryable,
  input: { userId: string; name: string },
): Promise<CreateScaleResult> {
  const result = await db.query(INSERT_SCALE_SQL, [input.userId, input.name, MAX_SCALES_PER_USER]);
  const row = insertScaleRowSchema.parse(result.rows[0]);
  if (!row.allowed) {
    return { status: "limit_reached" };
  }
  return row.id === null ? { status: "name_taken" } : { status: "created", scaleId: row.id };
}

export type RenameScaleResult =
  { status: "renamed" } | { status: "not_found" } | { status: "name_taken" };

/** Renomme un barème du propriétaire. `not_found` s'il n'existe pas ou n'est pas à lui. */
export async function renameScale(
  db: Queryable,
  input: { scaleId: string; owner: ScaleOwner; name: string },
): Promise<RenameScaleResult> {
  try {
    const result = await db.query(RENAME_SCALE_SQL, [
      input.scaleId,
      ownerParam(input.owner),
      input.name,
    ]);
    return result.rows.length > 0 ? { status: "renamed" } : { status: "not_found" };
  } catch (error: unknown) {
    if (isUniqueViolation(error, "scale_user_name_active_key")) {
      return { status: "name_taken" };
    }
    throw error;
  }
}

const lockedScaleRowSchema = z.object({ id: z.uuid(), in_use: z.boolean() });

export type DeleteScaleResult =
  { status: "deleted" } | { status: "archived" } | { status: "not_found" };

/**
 * Supprime un barème personnel. S'il est utilisé par une indemnité, il est seulement
 * archivé (soft delete) pour garder l'historique, et retiré des barèmes par défaut.
 * Le barème commun n'est jamais concerné (`user_id = $2`). À appeler dans une transaction.
 */
export async function deleteUserScale(
  db: Queryable,
  input: { scaleId: string; userId: string },
): Promise<DeleteScaleResult> {
  const locked = await db.query(LOCK_USER_SCALE_SQL, [input.scaleId, input.userId]);
  const row = locked.rows[0];
  if (row === undefined) {
    return { status: "not_found" };
  }
  if (lockedScaleRowSchema.parse(row).in_use) {
    await db.query(ARCHIVE_SCALE_SQL, [input.scaleId]);
    await db.query(DELETE_DEFAULTS_OF_SCALE_SQL, [input.scaleId]);
    return { status: "archived" };
  }
  // Les lignes et les défauts partent en cascade.
  await db.query(DELETE_SCALE_SQL, [input.scaleId]);
  return { status: "deleted" };
}

// ─── Lignes datées ──────────────────────────────────────────────────────────

// target : le barème s'il appartient au propriétaire ; inserted : la ligne, sous la limite.
const INSERT_RATE_SQL = `WITH target AS (
  SELECT s.id, (SELECT count(*) FROM scale_rate r WHERE r.scale_id = s.id) AS rate_count
  FROM scale s
  WHERE s.id = $1 AND s.user_id IS NOT DISTINCT FROM $2::uuid AND s.deleted_at IS NULL
),
inserted AS (
  INSERT INTO scale_rate (scale_id, effective_from, game_amount_cents, cents_per_km)
  SELECT id, $3::date, $4::integer, $5::numeric FROM target WHERE rate_count < $6::integer
  RETURNING id
)
SELECT (SELECT count(*) FROM target)::integer AS found, (SELECT id FROM inserted) AS id`;

const LOCK_RATE_SQL = `SELECT r.id,
  (SELECT count(*) FROM scale_rate o WHERE o.scale_id = r.scale_id)::integer AS rate_count,
  EXISTS (SELECT 1 FROM compensation c WHERE c.scale_rate_id = r.id) AS in_use
FROM scale_rate r
JOIN scale s ON s.id = r.scale_id
WHERE r.id = $1 AND s.user_id IS NOT DISTINCT FROM $2::uuid AND s.deleted_at IS NULL
FOR UPDATE OF s`;

const DELETE_RATE_SQL = `DELETE FROM scale_rate WHERE id = $1`;

export type ScaleRateInput = {
  scaleId: string;
  owner: ScaleOwner;
  effectiveFrom: string;
  gameAmountCents: number;
  centsPerKm: string;
};

export type InsertRateResult =
  | { status: "added"; rateId: string }
  | { status: "not_found" }
  | { status: "date_taken" }
  | { status: "limit_reached" };

const insertRateRowSchema = z.object({ found: z.number().int(), id: z.uuid().nullable() });

/** Ajoute une ligne datée à un barème du propriétaire. */
export async function insertScaleRate(
  db: Queryable,
  input: ScaleRateInput,
): Promise<InsertRateResult> {
  try {
    const result = await db.query(INSERT_RATE_SQL, [
      input.scaleId,
      ownerParam(input.owner),
      input.effectiveFrom,
      input.gameAmountCents,
      input.centsPerKm,
      MAX_RATES_PER_SCALE,
    ]);
    const row = insertRateRowSchema.parse(result.rows[0]);
    if (row.found === 0) {
      return { status: "not_found" };
    }
    return row.id === null ? { status: "limit_reached" } : { status: "added", rateId: row.id };
  } catch (error: unknown) {
    if (isUniqueViolation(error, "scale_rate_scale_effective_from_key")) {
      return { status: "date_taken" };
    }
    throw error;
  }
}

const lockedRateRowSchema = z.object({
  id: z.uuid(),
  rate_count: z.number().int(),
  in_use: z.boolean(),
});

export type DeleteRateResult =
  { status: "deleted" } | { status: "not_found" } | { status: "in_use" } | { status: "last_rate" };

/**
 * Supprime une ligne inutilisée. Un barème garde toujours au moins une ligne (il a
 * forcément un montant et un taux). Le verrou sur le barème empêche deux suppressions
 * simultanées de vider le barème. À appeler dans une transaction.
 */
export async function deleteScaleRate(
  db: Queryable,
  input: { rateId: string; owner: ScaleOwner },
): Promise<DeleteRateResult> {
  const locked = await db.query(LOCK_RATE_SQL, [input.rateId, ownerParam(input.owner)]);
  const raw = locked.rows[0];
  if (raw === undefined) {
    return { status: "not_found" };
  }
  const row = lockedRateRowSchema.parse(raw);
  if (row.in_use) {
    return { status: "in_use" };
  }
  if (row.rate_count <= 1) {
    return { status: "last_rate" };
  }
  await db.query(DELETE_RATE_SQL, [input.rateId]);
  return { status: "deleted" };
}

// ─── Barèmes par défaut par niveau ──────────────────────────────────────────

// N'insère que si la division existe et que le barème est un barème actif de l'utilisateur.
const UPSERT_LEVEL_DEFAULT_SQL = `INSERT INTO level_default_scale (user_id, division_id, scale_id)
SELECT $1::uuid, d.id, s.id
FROM division d
CROSS JOIN scale s
WHERE d.id = $2 AND s.id = $3 AND s.user_id = $1 AND s.deleted_at IS NULL
ON CONFLICT (user_id, division_id) DO UPDATE SET scale_id = EXCLUDED.scale_id
RETURNING division_id`;

const DELETE_LEVEL_DEFAULT_SQL = `DELETE FROM level_default_scale WHERE user_id = $1 AND division_id = $2`;

/**
 * Associe un niveau à un barème de l'utilisateur. Renvoie `false` si la division
 * n'existe pas ou si le barème n'est pas un barème actif de l'utilisateur.
 */
export async function upsertLevelDefault(
  db: Queryable,
  input: { userId: string; divisionId: string; scaleId: string },
): Promise<boolean> {
  const result = await db.query(UPSERT_LEVEL_DEFAULT_SQL, [
    input.userId,
    input.divisionId,
    input.scaleId,
  ]);
  return result.rows.length > 0;
}

/** Revient au barème commun pour ce niveau (sans effet s'il n'y avait pas de choix). */
export async function clearLevelDefault(
  db: Queryable,
  input: { userId: string; divisionId: string },
): Promise<void> {
  await db.query(DELETE_LEVEL_DEFAULT_SQL, [input.userId, input.divisionId]);
}