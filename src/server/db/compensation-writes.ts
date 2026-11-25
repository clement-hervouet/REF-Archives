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
import { MAX_CLUB_VENUES } from "@/lib/schemas/compensations";
import type { ClubVenue, NewClubChoice } from "@/lib/schemas/compensations";
import { MAX_COMPENSATIONS_PER_USER } from "./compensations";
import { cupRoundSchema } from "./divisions";
import type { CupRound } from "./divisions";
import type { Queryable } from "./users";

/** Limite anti-abus (application potentiellement publique). */
export const MAX_CLUBS_PER_USER = 1000;

/** Adresse à créer : seul le code postal est obligatoire (adresse de club partielle, §15.4.1). */
export type NewAddress = {
  /** Nom de la salle (« Gymnase de la Courrouze »), facultatif. */
  name: string | null;
  street: string | null;
  number: string | null;
  postalCode: string;
  city: string | null;
  country: string | null;
};

/**
 * Adresse d'un club créé à la volée (indemnité, match, collègue) : code postal seul, ou
 * adresse de sa salle principale quand il a été choisi dans l'annuaire FFBB.
 */
function newClubAddress(club: {
  postalCode: string;
  street?: string | null | undefined;
  number?: string | null | undefined;
  city?: string | null | undefined;
  venueName?: string | null | undefined;
}): NewAddress {
  return {
    name: club.venueName ?? null,
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

// Même salle = même code postal et même ville, puis même rue et même numéro ; sans rue,
// même nom. Une adresse réduite au code postal n'est jamais partagée : elle se complète
// dans « Clubs », en place, et ne doit pas entraîner celle d'un autre club. Une salle
// retrouvée sans nom prend celui qui arrive.
const FIND_OR_INSERT_ADDRESS_SQL = `WITH found AS (
  SELECT id FROM address
  WHERE user_id = $1::uuid AND postal_code = $4::text
    AND lower(coalesce(city, '')) = lower(coalesce($5::text, ''))
    AND (
      ($2::text IS NOT NULL AND lower(street) = lower($2::text)
        AND number IS NOT DISTINCT FROM $3::text)
      OR ($2::text IS NULL AND $7::text IS NOT NULL AND street IS NULL
        AND lower(name) = lower($7::text))
    )
  ORDER BY created_at, id
  LIMIT 1
),
named AS (
  UPDATE address SET name = $7::text
  WHERE id = (SELECT id FROM found) AND user_id = $1::uuid AND name IS NULL
    AND $7::text IS NOT NULL
),
inserted AS (
  INSERT INTO address (user_id, street, number, postal_code, city, country, name)
  SELECT $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text
  WHERE NOT EXISTS (SELECT 1 FROM found)
  RETURNING id
)
SELECT id FROM found UNION ALL SELECT id FROM inserted`;

/**
 * Adresse de l'utilisateur : la salle déjà connue s'il l'a (voir la règle ci-dessus),
 * sinon une nouvelle. Une salle partagée par deux clubs garde ainsi une seule adresse, ce
 * qui repère un doublé (§15.4.5).
 */
export async function findOrInsertAddress(
  db: Queryable,
  input: { userId: string; address: NewAddress },
): Promise<string> {
  const { address } = input;
  const result = await db.query(FIND_OR_INSERT_ADDRESS_SQL, [
    input.userId,
    address.street,
    address.number,
    address.postalCode,
    address.city,
    address.country,
    address.name,
  ]);
  return idRowSchema.parse(result.rows[0]).id;
}

// ─── Salles d'un club ───────────────────────────────────────────────────────

// Autres salles du club seulement : la principale (club.address_id) n'y entre jamais.
// Club et adresse de l'utilisateur, nombre de salles borné ; déjà rattachée : rien.
const ATTACH_CLUB_VENUE_SQL = `INSERT INTO club_venue (club_id, address_id, user_id)
SELECT c.id, a.id, c.user_id
FROM club c
JOIN address a ON a.id = $2::uuid AND a.user_id = c.user_id
WHERE c.id = $1::uuid AND c.user_id = $3::uuid AND c.address_id <> a.id
  AND (SELECT count(*) FROM club_venue v WHERE v.club_id = c.id) < $4::integer
ON CONFLICT DO NOTHING
RETURNING address_id`;

/**
 * Rattache une salle (adresse de l'utilisateur) à son club. Faux si rien n'a changé : déjà
 * rattachée, salle principale, club plein, ou club ou adresse introuvables.
 */
export async function attachClubVenue(
  db: Queryable,
  input: { userId: string; clubId: string; addressId: string },
): Promise<boolean> {
  const result = await db.query(ATTACH_CLUB_VENUE_SQL, [
    input.clubId,
    input.addressId,
    input.userId,
    MAX_CLUB_VENUES - 1,
  ]);
  return result.rows.length > 0;
}

/** Autres salles d'un club (annuaire FFBB) : chacune retrouvée ou créée, puis rattachée. */
export async function insertClubVenues(
  db: Queryable,
  input: { userId: string; clubId: string; venues: readonly ClubVenue[] },
): Promise<void> {
  for (const venue of input.venues) {
    const addressId = await findOrInsertAddress(db, {
      userId: input.userId,
      address: { ...venue, country: null },
    });
    await attachClubVenue(db, { userId: input.userId, clubId: input.clubId, addressId });
  }
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
 * Crée un club à la volée (indemnité, match, collègue) avec sa salle principale et ses
 * autres salles. `null` si l'utilisateur a atteint la limite de clubs : l'appelant annule
 * alors sa transaction (l'adresse créée part avec).
 */
export async function insertNewClub(
  db: Queryable,
  input: { userId: string; club: NewClubChoice },
): Promise<LockedClub | null> {
  const { userId, club } = input;
  const addressId = await findOrInsertAddress(db, { userId, address: newClubAddress(club) });
  const clubId = await insertClub(db, { userId, name: club.name, addressId });
  if (clubId === null) {
    return null;
  }
  await insertClubVenues(db, { userId, clubId, venues: club.venues ?? [] });
  return { id: clubId, addressId };
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
