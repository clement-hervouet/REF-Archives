/**
 * Requêtes SQL des indemnités (bloc 6) : saisie (adresses, clubs, équipes, barème
 * applicable), liste, totaux, modification et suppression.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`. Les FK composites (x_id, user_id)
 * l'imposent aussi en base ; les vérifications ici servent à répondre « introuvable »
 * proprement au lieu de laisser échouer une contrainte.
 */
import { z } from "zod";
import { effectivePayer } from "@/lib/payers";
import type { Payer } from "@/lib/payers";
import { divisionCategorySchema, divisionLevelSchema, divisionTypeSchema } from "./divisions";
import {
  MATCH_ADDRESS_COLUMNS,
  MATCH_PARTIES_COLUMNS,
  matchTeamJoins,
  toMatchAddress,
  toMatchParties,
} from "./match-info";
import type { MatchAddress, MatchDivision } from "./match-info";
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
  /** Organisme choisi explicitement (clé validée), ou `null` : déduit à l'affichage (bloc 10). */
  payer: string | null;
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
    user_id, scale_rate_id, distance_m, starts_at, division_id, team1_id, team2_id, address_id,
    payer
  )
  SELECT $1::uuid, $2::uuid, $3::integer, $4::timestamptz, $5::uuid, $6::uuid, $7::uuid, $8::uuid,
    $10::varchar
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
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
}

const COUNT_COMPENSATIONS_IN_RANGE_SQL = `SELECT count(*)::integer AS count
FROM compensation
WHERE user_id = $1 AND deleted_at IS NULL AND starts_at >= $2 AND starts_at < $3`;

const countRowSchema = z.object({ count: z.number().int().nonnegative() });

/**
 * Nombre d'indemnités actives de `userId` dont le match commence dans `[from, to[`
 * (ex. une saison FFBB, bloc 12d). Les indemnités supprimées ne comptent pas.
 */
export async function countCompensationsInRange(
  db: Queryable,
  input: { userId: string; from: Date; to: Date },
): Promise<number> {
  const result = await db.query(COUNT_COMPENSATIONS_IN_RANGE_SQL, [
    input.userId,
    input.from,
    input.to,
  ]);
  return countRowSchema.parse(result.rows[0]).count;
}

// ─── Lecture : liste, totaux, modification ─────────────────────────────────

/** Ce qu'il faut pour calculer le montant d'une indemnité (totaux mensuels). */
export type CompensationAmountRow = {
  startsAt: Date;
  distanceM: number;
  gameAmountCents: number;
  centsPerKm: string;
  /** Jour du paiement `AAAA-MM-JJ` (bloc 10), ou `null` s'il n'est pas encore payé. */
  paidOn: string | null;
  /** Organisme qui verse l'indemnité (choix enregistré, sinon déduit), ou `null` si inconnu. */
  payer: Payer | null;
};

export type CompensationListItem = CompensationAmountRow & {
  id: string;
  division: MatchDivision;
  team1Name: string;
  team2Name: string;
  address: MatchAddress;
  scaleName: string;
  /** Match complet lié (bloc 9), s'il existe. */
  gameId: string | null;
};

/** Valeurs d'une indemnité pour préremplir le formulaire de modification. */
export type CompensationForEdit = {
  id: string;
  startsAt: Date;
  divisionId: string;
  team1ClubId: string;
  team2ClubId: string;
  addressId: string;
  /** Adresse du club de l'équipe 1 : si c'est celle du match, la case « exception » est décochée. */
  team1AddressId: string;
  scaleId: string;
  distanceM: number;
  /** Organisme choisi explicitement (clé), ou `null` pour la déduction automatique. */
  payer: string | null;
};

// Les jointures reprennent user_id : on ne lit jamais l'équipe, le club ou l'adresse d'un autre.
// Niveau, code postal et pays : de quoi déduire l'organisme qui verse (bloc 10).
const LIST_AMOUNTS_SQL = `SELECT c.starts_at, c.distance_m, r.game_amount_cents,
  r.cents_per_km::text AS cents_per_km, c.paid_on::text AS paid_on,
  c.payer AS payer_override, d.division, a.postal_code, a.country
FROM compensation c
JOIN scale_rate r ON r.id = c.scale_rate_id
JOIN division d ON d.id = c.division_id
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
WHERE c.user_id = $1 AND c.deleted_at IS NULL`;

// `paid_on::text` : une colonne `date` lue telle quelle deviendrait un Date JavaScript à
// minuit dans le fuseau du serveur, et pourrait changer de jour.
const LIST_IN_RANGE_SQL = `SELECT c.id, c.starts_at, c.distance_m, c.game_id, c.paid_on::text AS paid_on,
  c.payer AS payer_override,
  ${MATCH_PARTIES_COLUMNS},
  ${MATCH_ADDRESS_COLUMNS}, a.country,
  s.name AS scale_name, r.game_amount_cents, r.cents_per_km::text AS cents_per_km
FROM compensation c
JOIN division d ON d.id = c.division_id
${matchTeamJoins("c")}
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
JOIN scale_rate r ON r.id = c.scale_rate_id
JOIN scale s ON s.id = r.scale_id
WHERE c.user_id = $1 AND c.deleted_at IS NULL AND c.starts_at >= $2 AND c.starts_at < $3
ORDER BY c.starts_at, c.id`;

const FIND_FOR_EDIT_SQL = `SELECT c.id, c.starts_at, c.division_id, c.address_id, c.distance_m, c.payer,
  t1.club_id AS team1_club_id, t2.club_id AS team2_club_id,
  club1.address_id AS team1_address_id, r.scale_id
FROM compensation c
JOIN team t1 ON t1.id = c.team1_id AND t1.user_id = c.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = c.user_id
JOIN team t2 ON t2.id = c.team2_id AND t2.user_id = c.user_id
JOIN scale_rate r ON r.id = c.scale_rate_id
WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL`;

const amountRowSchema = z.object({
  starts_at: z.date(),
  distance_m: z.number().int(),
  game_amount_cents: z.number().int(),
  cents_per_km: z.string(),
  paid_on: z.string().nullable(),
  payer_override: z.string().nullable(),
  division: divisionCategorySchema,
  postal_code: z.string(),
  country: z.string().nullable(),
});

const listItemRowSchema = amountRowSchema.extend({
  id: z.uuid(),
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  team1_name: z.string(),
  team2_name: z.string(),
  street: z.string(),
  number: z.string().nullable(),
  city: z.string(),
  scale_name: z.string(),
  game_id: z.uuid().nullable(),
});

const editRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  division_id: z.uuid(),
  address_id: z.uuid(),
  distance_m: z.number().int(),
  team1_club_id: z.uuid(),
  team2_club_id: z.uuid(),
  team1_address_id: z.uuid(),
  scale_id: z.uuid(),
  payer: z.string().nullable(),
});

function toAmountRow(row: z.infer<typeof amountRowSchema>): CompensationAmountRow {
  return {
    startsAt: row.starts_at,
    distanceM: row.distance_m,
    gameAmountCents: row.game_amount_cents,
    centsPerKm: row.cents_per_km,
    paidOn: row.paid_on,
    payer: effectivePayer({
      override: row.payer_override,
      category: row.division,
      postalCode: row.postal_code,
      country: row.country,
    }),
  };
}

/** Toutes les indemnités actives de l'utilisateur, réduites au calcul du montant. */
export async function listCompensationAmounts(
  db: Queryable,
  userId: string,
): Promise<CompensationAmountRow[]> {
  const result = await db.query(LIST_AMOUNTS_SQL, [userId]);
  return result.rows.map((raw) => toAmountRow(amountRowSchema.parse(raw)));
}

/** Indemnités actives dont le match commence dans `[from, to)`, de la plus ancienne à la plus récente. */
export async function listCompensationsInRange(
  db: Queryable,
  input: { userId: string; from: Date; to: Date },
): Promise<CompensationListItem[]> {
  const result = await db.query(LIST_IN_RANGE_SQL, [input.userId, input.from, input.to]);
  return result.rows.map((raw) => {
    const row = listItemRowSchema.parse(raw);
    return {
      ...toAmountRow(row),
      id: row.id,
      ...toMatchParties(row),
      address: toMatchAddress(row),
      scaleName: row.scale_name,
      gameId: row.game_id,
    };
  });
}

/** Indemnité active de l'utilisateur, pour la modifier ; `null` si introuvable ou supprimée. */
export async function findCompensationForEdit(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<CompensationForEdit | null> {
  const result = await db.query(FIND_FOR_EDIT_SQL, [input.compensationId, input.userId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = editRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    divisionId: row.division_id,
    team1ClubId: row.team1_club_id,
    team2ClubId: row.team2_club_id,
    addressId: row.address_id,
    team1AddressId: row.team1_address_id,
    scaleId: row.scale_id,
    distanceM: row.distance_m,
    payer: row.payer,
  };
}

// ─── Modification et suppression ───────────────────────────────────────────

const LOCK_COMPENSATION_SQL = `SELECT id FROM compensation
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
FOR UPDATE`;

const UPDATE_COMPENSATION_SQL = `UPDATE compensation
SET scale_rate_id = $3, distance_m = $4, starts_at = $5, division_id = $6,
  team1_id = $7, team2_id = $8, address_id = $9, payer = $10
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING id`;

// Soft delete (§5.6) : la purge physique viendra avec le job planifié.
const SOFT_DELETE_COMPENSATION_SQL = `UPDATE compensation
SET deleted_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING id`;

/**
 * Verrouille une indemnité active de l'utilisateur jusqu'à la fin de la transaction.
 * Faux si elle n'existe pas, est supprimée ou appartient à un autre utilisateur.
 */
export async function lockCompensation(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<boolean> {
  const result = await db.query(LOCK_COMPENSATION_SQL, [input.compensationId, input.userId]);
  return result.rows.length > 0;
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
