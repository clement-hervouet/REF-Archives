/**
 * Requêtes SQL de la saisie d'une indemnité (bloc 6) : adresses, clubs, équipes, barème
 * applicable et indemnité elle-même.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`. Les FK composites (x_id, user_id)
 * l'imposent aussi en base ; les vérifications ici servent à répondre « introuvable »
 * proprement au lieu de laisser échouer une contrainte.
 */
import { z } from "zod";
import type { Queryable } from "./users";

/** Limites anti-abus (application potentiellement publique). */
export const MAX_CLUBS_PER_USER = 1000;
export const MAX_COMPENSATIONS_PER_USER = 10_000;

export type NewAddress = {
  street: string;
  number: string | null;
  postalCode: string;
  city: string;
  country: string | null;
};

/** Club verrouillé pour la transaction, avec son adresse (adresse par défaut du match). */
export type LockedClub = { id: string; addressId: string };

/** Ligne de barème utilisable pour calculer une indemnité. */
export type ApplicableRate = {
  id: string;
  /** Date d'application `AAAA-MM-JJ` (Europe/Paris). */
  effectiveFrom: string;
  gameAmountCents: number;
  /** Centimes par km, chaîne `numeric` exacte (ex. `"40.00"`). */
  centsPerKm: string;
};

export type NewCompensation = {
  userId: string;
  scaleRateId: string;
  distanceM: number;
  startsAt: Date;
  divisionId: string;
  team1Id: string;
  team2Id: string;
  addressId: string;
};

const idRowSchema = z.object({ id: z.uuid() });
const nullableIdRowSchema = z.object({ id: z.uuid().nullable() });

// ─── Référentiel ────────────────────────────────────────────────────────────

const DIVISION_EXISTS_SQL = `SELECT id FROM division WHERE id = $1`;

/** Vrai si la division (niveau) existe dans le référentiel global. */
export async function divisionExists(db: Queryable, divisionId: string): Promise<boolean> {
  const result = await db.query(DIVISION_EXISTS_SQL, [divisionId]);
  return result.rows.length > 0;
}

// ─── Barème applicable ──────────────────────────────────────────────────────

// LEFT JOIN : un barème choisissable mais encore sans ligne renvoie une ligne de NULL,
// ce qui distingue « barème introuvable » de « aucune ligne en vigueur ».
// Choisissable = à l'utilisateur ou commun, et non archivé.
const LIST_APPLICABLE_RATES_SQL = `SELECT r.id, r.effective_from::text AS effective_from,
  r.game_amount_cents, r.cents_per_km::text AS cents_per_km
FROM scale s
LEFT JOIN scale_rate r ON r.scale_id = s.id
WHERE s.id = $1 AND (s.user_id = $2 OR s.user_id IS NULL) AND s.deleted_at IS NULL`;

const applicableRateRowSchema = z.union([
  z.object({
    id: z.uuid(),
    effective_from: z.string(),
    game_amount_cents: z.number().int(),
    cents_per_km: z.string(),
  }),
  z.object({
    id: z.null(),
    effective_from: z.null(),
    game_amount_cents: z.null(),
    cents_per_km: z.null(),
  }),
]);

/**
 * Lignes d'un barème que l'utilisateur peut choisir (le sien ou le commun).
 * `null` si le barème n'existe pas, est archivé ou appartient à un autre utilisateur.
 */
export async function listApplicableRates(
  db: Queryable,
  input: { scaleId: string; userId: string },
): Promise<ApplicableRate[] | null> {
  const result = await db.query(LIST_APPLICABLE_RATES_SQL, [input.scaleId, input.userId]);
  if (result.rows.length === 0) {
    return null;
  }
  const rates: ApplicableRate[] = [];
  for (const raw of result.rows) {
    const row = applicableRateRowSchema.parse(raw);
    if (row.id !== null) {
      rates.push({
        id: row.id,
        effectiveFrom: row.effective_from,
        gameAmountCents: row.game_amount_cents,
        centsPerKm: row.cents_per_km,
      });
    }
  }
  return rates;
}

// ─── Adresses et clubs ──────────────────────────────────────────────────────

const INSERT_ADDRESS_SQL = `INSERT INTO address (user_id, street, number, postal_code, city, country)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id`;

const ADDRESS_OWNED_SQL = `SELECT id FROM address WHERE id = $1 AND user_id = $2`;

/** Crée une adresse de l'utilisateur. */
export async function insertAddress(
  db: Queryable,
  input: { userId: string; address: NewAddress },
): Promise<string> {
  const { address } = input;
  const result = await db.query(INSERT_ADDRESS_SQL, [
    input.userId,
    address.street,
    address.number,
    address.postalCode,
    address.city,
    address.country,
  ]);
  return idRowSchema.parse(result.rows[0]).id;
}

/** Vrai si l'adresse existe et appartient à l'utilisateur. */
export async function addressBelongsTo(
  db: Queryable,
  input: { addressId: string; userId: string },
): Promise<boolean> {
  const result = await db.query(ADDRESS_OWNED_SQL, [input.addressId, input.userId]);
  return result.rows.length > 0;
}

// Ne lève jamais d'erreur : id NULL = limite atteinte.
const INSERT_CLUB_SQL = `WITH allowed AS (
  SELECT (SELECT count(*) FROM club WHERE user_id = $1::uuid) < $4::integer AS ok
),
inserted AS (
  INSERT INTO club (user_id, address_id, name)
  SELECT $1::uuid, $2::uuid, $3::text FROM allowed WHERE ok
  RETURNING id
)
SELECT (SELECT id FROM inserted) AS id`;

// Ordre fixe (id) : deux transactions qui verrouillent les mêmes clubs ne s'interbloquent pas.
const LOCK_CLUBS_SQL = `SELECT id, address_id
FROM club
WHERE id = ANY($1::uuid[]) AND user_id = $2
ORDER BY id
FOR UPDATE`;

const lockedClubRowSchema = z.object({ id: z.uuid(), address_id: z.uuid() });

/**
 * Crée un club (sans numéro d'affiliation, facultatif). `null` si l'utilisateur a
 * atteint la limite de clubs.
 */
export async function insertClub(
  db: Queryable,
  input: { userId: string; name: string; addressId: string },
): Promise<string | null> {
  const result = await db.query(INSERT_CLUB_SQL, [
    input.userId,
    input.addressId,
    input.name,
    MAX_CLUBS_PER_USER,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
}

/**
 * Verrouille les clubs de l'utilisateur parmi `clubIds` (jusqu'à la fin de la
 * transaction) et renvoie leur adresse. Un identifiant absent du résultat n'existe pas
 * ou n'est pas à lui. Le verrou évite de créer deux fois la même équipe en parallèle.
 */
export async function lockOwnedClubs(
  db: Queryable,
  input: { userId: string; clubIds: readonly string[] },
): Promise<Map<string, LockedClub>> {
  const clubs = new Map<string, LockedClub>();
  if (input.clubIds.length === 0) {
    return clubs;
  }
  const result = await db.query(LOCK_CLUBS_SQL, [input.clubIds, input.userId]);
  for (const raw of result.rows) {
    const row = lockedClubRowSchema.parse(raw);
    clubs.set(row.id, { id: row.id, addressId: row.address_id });
  }
  return clubs;
}

// ─── Équipes ────────────────────────────────────────────────────────────────

// Une équipe = un club à un niveau. La plus ancienne si des doublons existent déjà.
const FIND_TEAM_SQL = `SELECT id
FROM team
WHERE club_id = $1 AND user_id = $2 AND division_id = $3
ORDER BY created_at
LIMIT 1`;

const INSERT_TEAM_SQL = `INSERT INTO team (user_id, club_id, division_id)
VALUES ($1, $2, $3)
RETURNING id`;

/**
 * Équipe du club au niveau donné, créée si besoin. Le club doit appartenir à
 * l'utilisateur et être verrouillé (ou créé) dans la même transaction.
 */
export async function ensureTeam(
  db: Queryable,
  input: { userId: string; clubId: string; divisionId: string },
): Promise<string> {
  const params = [input.clubId, input.userId, input.divisionId];
  const found = await db.query(FIND_TEAM_SQL, params);
  const existing = found.rows[0];
  if (existing !== undefined) {
    return idRowSchema.parse(existing).id;
  }
  const inserted = await db.query(INSERT_TEAM_SQL, [input.userId, input.clubId, input.divisionId]);
  return idRowSchema.parse(inserted.rows[0]).id;
}

// ─── Indemnité ──────────────────────────────────────────────────────────────

// Ne lève jamais d'erreur de limite : id NULL = limite atteinte.
const INSERT_COMPENSATION_SQL = `WITH allowed AS (
  SELECT (
    SELECT count(*) FROM compensation WHERE user_id = $1::uuid AND deleted_at IS NULL
  ) < $9::integer AS ok
),
inserted AS (
  INSERT INTO compensation (
    user_id, scale_rate_id, distance_m, starts_at, division_id, team1_id, team2_id, address_id
  )
  SELECT $1::uuid, $2::uuid, $3::integer, $4::timestamptz, $5::uuid, $6::uuid, $7::uuid, $8::uuid
  FROM allowed
  WHERE ok
  RETURNING id
)
SELECT (SELECT id FROM inserted) AS id`;

/** Crée l'indemnité. `null` si l'utilisateur a atteint la limite d'indemnités actives. */
export async function insertCompensation(
  db: Queryable,
  input: NewCompensation,
): Promise<string | null> {
  const result = await db.query(INSERT_COMPENSATION_SQL, [
    input.userId,
    input.scaleRateId,
    input.distanceM,
    input.startsAt,
    input.divisionId,
    input.team1Id,
    input.team2Id,
    input.addressId,
    MAX_COMPENSATIONS_PER_USER,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
}
