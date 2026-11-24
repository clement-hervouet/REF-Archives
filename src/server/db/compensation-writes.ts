/**
 * Écritures de la saisie d'une indemnité (bloc 6) : adresses, clubs, équipes, l'indemnité
 * elle-même, puis sa modification et sa suppression. Chaque fonction exécute une seule
 * requête ; les services les orchestrent en transaction. Les lectures sont dans
 * `compensations.ts`.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`. Les FK composites (x_id, user_id)
 * l'imposent aussi en base.
 */
import { z } from "zod";
import { MAX_COMPENSATIONS_PER_USER } from "./compensations";
import { cupRoundSchema } from "./divisions";
import type { CupRound } from "./divisions";
import type { Queryable } from "./users";

/** Limite anti-abus (application potentiellement publique). */
export const MAX_CLUBS_PER_USER = 1000;

/** Adresse à créer : seul le code postal est obligatoire (adresse de club partielle, §15.4.1). */
export type NewAddress = {
  street: string | null;
  number: string | null;
  postalCode: string;
  city: string | null;
  country: string | null;
};

/**
 * Adresse d'un club créé à la volée (indemnité, match, collègue) : code postal seul, ou
 * adresse de sa salle quand il a été choisi dans l'annuaire FFBB.
 */
export function newClubAddress(club: {
  postalCode: string;
  street?: string | null | undefined;
  number?: string | null | undefined;
  city?: string | null | undefined;
}): NewAddress {
  return {
    street: club.street ?? null,
    number: club.number ?? null,
    postalCode: club.postalCode,
    city: club.city ?? null,
    country: null,
  };
}

/** Club verrouillé pour la transaction, avec son adresse (adresse par défaut du match). */
export type LockedClub = { id: string; addressId: string };

export type NewCompensation = {
  userId: string;
  scaleRateId: string;
  distanceM: number;
  startsAt: Date;
  divisionId: string;
  /** Tour de coupe (§15.4.6), `null` hors coupe. */
  cupRound: CupRound | null;
  team1Id: string;
  /** `null` pour un plateau (§15.4.7). */
  team2Id: string | null;
  addressId: string;
  /** Organisme choisi explicitement (clé validée), ou `null` : déduit à l'affichage (bloc 10). */
  payer: string | null;
  /** Doublé (§15.4.5) : déplacement déjà indemnisé sur un autre match, kilométrage à 0. */
  travelShared: boolean;
  /** Nombre de matchs d'un plateau (§15.4.7), `null` hors plateau. */
  gameCount: number | null;
  /** Montant par match saisi pour un plateau (centimes), `null` hors plateau. */
  plateauGameCents: number | null;
};

const idRowSchema = z.object({ id: z.uuid() });
const nullableIdRowSchema = z.object({ id: z.uuid().nullable() });

// ─── Adresses et clubs ──────────────────────────────────────────────────────

const INSERT_ADDRESS_SQL = `INSERT INTO address (user_id, street, number, postal_code, city, country)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id`;

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
    user_id, scale_rate_id, distance_m, starts_at, division_id, team1_id, team2_id, address_id,
    payer, travel_shared, cup_round, game_count, plateau_game_cents
  )
  SELECT $1::uuid, $2::uuid, $3::integer, $4::timestamptz, $5::uuid, $6::uuid, $7::uuid, $8::uuid,
    $10::varchar, $11::boolean, $12::cup_round, $13::smallint, $14::integer
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
    input.payer,
    input.travelShared,
    input.cupRound,
    input.gameCount,
    input.plateauGameCents,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
}

// ─── Modification et suppression ───────────────────────────────────────────

// Le tour actuel sert à ne fêter une finale qu'au moment où elle est enregistrée (§15.4.6).
const LOCK_COMPENSATION_SQL = `SELECT cup_round FROM compensation
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
FOR UPDATE`;

const UPDATE_COMPENSATION_SQL = `UPDATE compensation
SET scale_rate_id = $3, distance_m = $4, starts_at = $5, division_id = $6,
  team1_id = $7, team2_id = $8, address_id = $9, payer = $10, travel_shared = $11,
  cup_round = $12, game_count = $13, plateau_game_cents = $14
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING id`;

// Soft delete (§5.6) : la purge physique viendra avec le job planifié.
const SOFT_DELETE_COMPENSATION_SQL = `UPDATE compensation
SET deleted_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING id`;

const lockedCompensationRowSchema = z.object({ cup_round: cupRoundSchema.nullable() });

/**
 * Verrouille une indemnité active de l'utilisateur jusqu'à la fin de la transaction et
 * renvoie son tour de coupe actuel. `null` si elle n'existe pas, est supprimée ou
 * appartient à un autre utilisateur.
 */
export async function lockCompensation(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<{ cupRound: CupRound | null } | null> {
  const result = await db.query(LOCK_COMPENSATION_SQL, [input.compensationId, input.userId]);
  const raw: unknown = result.rows[0];
  return raw === undefined ? null : { cupRound: lockedCompensationRowSchema.parse(raw).cup_round };
}

/** Remplace les informations d'une indemnité active de l'utilisateur. */
export async function updateCompensation(
  db: Queryable,
  input: Omit<NewCompensation, "userId"> & { compensationId: string; userId: string },
): Promise<boolean> {
  const result = await db.query(UPDATE_COMPENSATION_SQL, [
    input.compensationId,
    input.userId,
    input.scaleRateId,
    input.distanceM,
    input.startsAt,
    input.divisionId,
    input.team1Id,
    input.team2Id,
    input.addressId,
    input.payer,
    input.travelShared,
    input.cupRound,
    input.gameCount,
    input.plateauGameCents,
  ]);
  return result.rows.length > 0;
}

/** Supprime (soft delete) une indemnité active de l'utilisateur. Faux si introuvable. */
export async function softDeleteCompensation(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<boolean> {
  const result = await db.query(SOFT_DELETE_COMPENSATION_SQL, [input.compensationId, input.userId]);
  return result.rows.length > 0;
}
