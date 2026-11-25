/**
 * Clubs et adresses d'un utilisateur : listes du formulaire d'indemnité (bloc 6) et
 * gestion des fiches dans l'onglet « Clubs » (§15.4.1). Toujours filtré par
 * propriétaire (§6.2).
 *
 * Une adresse de club peut être partielle : le code postal est obligatoire, la rue et la
 * ville facultatives (migration 022). Modifier l'adresse d'un club met à jour sa ligne
 * `address` en place : les indemnités et matchs qui la référencent (matchs à domicile du
 * club) suivent donc l'adresse complétée.
 *
 * Un club a une salle principale (`club.address_id`) et d'autres salles (`club_venue`,
 * migration 032), proposées pour un match où il reçoit.
 */
import { z } from "zod";
import { MAX_CLUB_VENUES } from "@/lib/schemas/compensations";
import type { ClubFormValue } from "@/lib/schemas/clubs";
import { MAX_CLUBS_PER_USER, insertClubVenues } from "./compensation-writes";
import type { Queryable } from "./users";

export type AddressSummary = {
  id: string;
  /** Nom de la salle (« Gymnase de la Courrouze »), `null` s'il n'est pas connu. */
  name: string | null;
  /** Rue, `null` tant que l'adresse du club n'est pas complétée (§15.4.1). */
  street: string | null;
  number: string | null;
  postalCode: string;
  /** Ville, `null` tant que l'adresse du club n'est pas complétée (§15.4.1). */
  city: string | null;
  /** Pays (facultatif, vide = France) : sert à déduire l'organisme qui verse (bloc 10). */
  country: string | null;
};

export type ClubSummary = {
  id: string;
  name: string;
  /** Salle principale du club : adresse par défaut d'un match où il reçoit (équipe 1). */
  address: AddressSummary;
  /** Autres salles du club, par nom puis par ville. */
  venues: readonly AddressSummary[];
};

const addressRowSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  street: z.string().nullable(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
});

const clubRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address_id: z.uuid(),
  venue_name: z.string().nullable(),
  street: z.string().nullable(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
});

const clubVenueRowSchema = addressRowSchema.extend({ club_id: z.uuid() });

const LIST_CLUBS_SQL = `SELECT c.id, c.name, a.id AS address_id, a.name AS venue_name, a.street, a.number,
  a.postal_code, a.city, a.country
FROM club c
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
WHERE c.user_id = $1
ORDER BY lower(c.name), lower(a.city) NULLS LAST, a.postal_code, c.id`;

// La salle principale n'est pas répétée, même si un lien la cite encore.
const LIST_CLUB_VENUES_SQL = `SELECT v.club_id, a.id, a.name, a.street, a.number, a.postal_code, a.city,
  a.country
FROM club_venue v
JOIN club c ON c.id = v.club_id AND c.user_id = v.user_id
JOIN address a ON a.id = v.address_id AND a.user_id = v.user_id
WHERE v.user_id = $1 AND v.address_id <> c.address_id
ORDER BY lower(a.name) NULLS LAST, lower(a.city) NULLS LAST, a.postal_code,
  lower(a.street) NULLS LAST, a.id`;

const LIST_ADDRESSES_SQL = `SELECT id, name, street, number, postal_code, city, country
FROM address
WHERE user_id = $1
ORDER BY lower(city) NULLS LAST, postal_code, lower(street) NULLS LAST, number, lower(name)`;

function toAddress(row: z.output<typeof addressRowSchema>): AddressSummary {
  return {
    id: row.id,
    name: row.name,
    street: row.street,
    number: row.number,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
  };
}

/** Clubs de l'utilisateur avec leurs salles, par ordre alphabétique. */
export async function listClubs(db: Queryable, userId: string): Promise<ClubSummary[]> {
  const clubs = await db.query(LIST_CLUBS_SQL, [userId]);
  const venues = await db.query(LIST_CLUB_VENUES_SQL, [userId]);
  const venuesByClub = new Map<string, AddressSummary[]>();
  for (const raw of venues.rows) {
    const { club_id: clubId, ...row } = clubVenueRowSchema.parse(raw);
    const list = venuesByClub.get(clubId) ?? [];
    list.push(toAddress(row));
    venuesByClub.set(clubId, list);
  }
  return clubs.rows.map((raw) => {
    const row = clubRowSchema.parse(raw);
    return {
      id: row.id,
      name: row.name,
      address: toAddress({ ...row, id: row.address_id, name: row.venue_name }),
      venues: venuesByClub.get(row.id) ?? [],
    };
  });
}

/** Adresses connues de l'utilisateur (clubs et salles), par ville puis rue. */
export async function listAddresses(db: Queryable, userId: string): Promise<AddressSummary[]> {
  const result = await db.query(LIST_ADDRESSES_SQL, [userId]);
  return result.rows.map((raw) => toAddress(addressRowSchema.parse(raw)));
}

const OWNED_CLUB_SQL = `SELECT id FROM club WHERE id = $1 AND user_id = $2`;

/** Vrai si le club appartient à l'utilisateur. */
export async function isOwnedClub(
  db: Queryable,
  input: { userId: string; clubId: string },
): Promise<boolean> {
  const result = await db.query(OWNED_CLUB_SQL, [input.clubId, input.userId]);
  return result.rows.length > 0;
}

// ─── Gestion des fiches (onglet « Clubs », §15.4.1) ─────────────────────────

const nullableIdRowSchema = z.object({ id: z.uuid().nullable() });
const addressIdRowSchema = z.object({ address_id: z.uuid() });

// Adresse et club en une requête : la limite est vérifiée avant toute écriture, donc
// aucune adresse orpheline quand elle est atteinte (id NULL, jamais d'erreur).
const INSERT_CLUB_WITH_ADDRESS_SQL = `WITH allowed AS (
  SELECT (SELECT count(*) FROM club WHERE user_id = $1::uuid) < $9::integer AS ok
),
new_address AS (
  INSERT INTO address (user_id, street, number, postal_code, city, country, name)
  SELECT $1::uuid, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text
  FROM allowed WHERE ok
  RETURNING id
),
new_club AS (
  INSERT INTO club (user_id, address_id, name)
  SELECT $1::uuid, new_address.id, $2::text FROM new_address
  RETURNING id
)
SELECT (SELECT id FROM new_club) AS id`;

// Nom du club et adresse (sa ligne, mise à jour en place) en une requête.
const UPDATE_CLUB_SQL = `WITH updated_club AS (
  UPDATE club SET name = $3
  WHERE id = $1 AND user_id = $2
  RETURNING address_id, user_id
)
UPDATE address a
SET street = $4, number = $5, postal_code = $6, city = $7, country = $8, name = $9
FROM updated_club u
WHERE a.id = u.address_id AND a.user_id = u.user_id
RETURNING a.id`;

// Les équipes partent avec le club (CASCADE), mais une équipe citée par une indemnité ou un
// match (même supprimé, en attente de purge) bloque la suppression (FK en NO ACTION) : le
// NOT EXISTS répond « utilisé » proprement au lieu de laisser échouer la contrainte. Les
// collègues rattachés perdent seulement leur club (SET NULL).
const DELETE_CLUB_SQL = `DELETE FROM club c
WHERE c.id = $1 AND c.user_id = $2
  AND NOT EXISTS (
    SELECT 1 FROM team t
    WHERE t.club_id = c.id AND t.user_id = c.user_id
      AND (
        EXISTS (
          SELECT 1 FROM compensation x
          WHERE x.user_id = t.user_id AND t.id IN (x.team1_id, x.team2_id)
        )
        OR EXISTS (
          SELECT 1 FROM game g
          WHERE g.user_id = t.user_id AND t.id IN (g.team1_id, g.team2_id)
        )
      )
  )
RETURNING c.address_id`;

const LIST_VENUE_IDS_SQL = `SELECT address_id FROM club_venue WHERE club_id = $1 AND user_id = $2`;

// Les salles du club supprimé (ou retirée de ses salles) partent aussi si plus rien ne les
// cite (sinon elles encombreraient la liste des adresses connues). Une salle choisie par
// un match, ou salle d'un autre club, est gardée.
const DELETE_UNUSED_ADDRESSES_SQL = `DELETE FROM address a
WHERE a.id = ANY($1::uuid[]) AND a.user_id = $2
  AND NOT EXISTS (SELECT 1 FROM club c WHERE c.address_id = a.id AND c.user_id = a.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM club_venue v WHERE v.address_id = a.id AND v.user_id = a.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM compensation x WHERE x.address_id = a.id AND x.user_id = a.user_id
  )
  AND NOT EXISTS (SELECT 1 FROM game g WHERE g.address_id = a.id AND g.user_id = a.user_id)
  AND NOT EXISTS (SELECT 1 FROM person p WHERE p.address_id = a.id AND p.user_id = a.user_id)`;

function clubParams(club: ClubFormValue): (string | null)[] {
  return [
    club.name,
    club.street,
    club.number,
    club.postalCode,
    club.city,
    club.country,
    club.venueName,
  ];
}

/**
 * Crée un club avec sa salle principale, puis ses autres salles (annuaire FFBB). `null` si
 * l'utilisateur a atteint la limite de clubs.
 */
export async function insertClubWithAddress(
  db: Queryable,
  input: { userId: string; club: ClubFormValue },
): Promise<string | null> {
  const result = await db.query(INSERT_CLUB_WITH_ADDRESS_SQL, [
    input.userId,
    ...clubParams(input.club),
    MAX_CLUBS_PER_USER,
  ]);
  const clubId = nullableIdRowSchema.parse(result.rows[0]).id;
  if (clubId !== null && input.club.venues.length > 0) {
    await insertClubVenues(db, { userId: input.userId, clubId, venues: input.club.venues });
  }
  return clubId;
}

/** Modifie le nom et l'adresse d'un club de l'utilisateur. Faux s'il est introuvable. */
export async function updateClubWithAddress(
  db: Queryable,
  input: { userId: string; clubId: string; club: ClubFormValue },
): Promise<boolean> {
  const result = await db.query(UPDATE_CLUB_SQL, [
    input.clubId,
    input.userId,
    ...clubParams(input.club),
  ]);
  return result.rows.length > 0;
}

export type DeleteClubResult = "deleted" | "in_use" | "not_found";

/**
 * Supprime un club qu'aucune indemnité ni aucun match ne cite, puis ses salles qui ne sont
 * plus utilisées. À appeler dans une transaction.
 */
export async function deleteClub(
  db: Queryable,
  input: { userId: string; clubId: string },
): Promise<DeleteClubResult> {
  // Lues avant : les liens partent avec le club (CASCADE).
  const venues = await db.query(LIST_VENUE_IDS_SQL, [input.clubId, input.userId]);
  const deleted = await db.query(DELETE_CLUB_SQL, [input.clubId, input.userId]);
  const row = deleted.rows[0];
  if (row !== undefined) {
    const { address_id: addressId } = addressIdRowSchema.parse(row);
    const venueIds = venues.rows.map((raw) => addressIdRowSchema.parse(raw).address_id);
    await db.query(DELETE_UNUSED_ADDRESSES_SQL, [[addressId, ...venueIds], input.userId]);
    return "deleted";
  }
  return (await isOwnedClub(db, input)) ? "in_use" : "not_found";
}

// ─── Salles d'un club (onglet « Clubs ») ────────────────────────────────────

const LOCK_CLUB_VENUES_SQL = `SELECT c.address_id,
  (SELECT count(*) FROM club_venue v WHERE v.club_id = c.id)::integer AS venue_count
FROM club c
WHERE c.id = $1 AND c.user_id = $2
FOR UPDATE`;

const lockedVenuesRowSchema = z.object({ address_id: z.uuid(), venue_count: z.number().int() });

/**
 * Verrouille un club de l'utilisateur jusqu'à la fin de la transaction : sa salle
 * principale et le nombre de places restantes pour d'autres salles. `null` s'il est
 * introuvable.
 */
export async function lockClubVenues(
  db: Queryable,
  input: { userId: string; clubId: string },
): Promise<{ mainAddressId: string; free: number } | null> {
  const result = await db.query(LOCK_CLUB_VENUES_SQL, [input.clubId, input.userId]);
  const raw: unknown = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = lockedVenuesRowSchema.parse(raw);
  return {
    mainAddressId: row.address_id,
    free: Math.max(0, MAX_CLUB_VENUES - 1 - row.venue_count),
  };
}

const DETACH_VENUE_SQL = `DELETE FROM club_venue
WHERE club_id = $1 AND user_id = $2 AND address_id = $3
RETURNING address_id`;

/**
 * Retire une autre salle d'un club, puis son adresse si plus rien ne la cite. Faux si ce
 * n'est pas une salle du club (la principale ne se retire pas).
 */
export async function detachClubVenue(
  db: Queryable,
  input: { userId: string; clubId: string; addressId: string },
): Promise<boolean> {
  const result = await db.query(DETACH_VENUE_SQL, [input.clubId, input.userId, input.addressId]);
  if (result.rows.length === 0) {
    return false;
  }
  await db.query(DELETE_UNUSED_ADDRESSES_SQL, [[input.addressId], input.userId]);
  return true;
}

const SET_MAIN_ADDRESS_SQL = `UPDATE club SET address_id = $3 WHERE id = $1 AND user_id = $2`;

const KEEP_OLD_MAIN_SQL = `INSERT INTO club_venue (club_id, address_id, user_id)
VALUES ($1, $3, $2)
ON CONFLICT DO NOTHING`;

/**
 * Fait d'une autre salle la salle principale du club ; l'ancienne principale rejoint ses
 * autres salles. Le club doit être verrouillé (`lockClubVenues`) dans la même
 * transaction. Faux si ce n'est pas une salle du club.
 */
export async function setMainClubVenue(
  db: Queryable,
  input: { userId: string; clubId: string; addressId: string; oldMainAddressId: string },
): Promise<boolean> {
  const removed = await db.query(DETACH_VENUE_SQL, [input.clubId, input.userId, input.addressId]);
  if (removed.rows.length === 0) {
    return false;
  }
  await db.query(SET_MAIN_ADDRESS_SQL, [input.clubId, input.userId, input.addressId]);
  await db.query(KEEP_OLD_MAIN_SQL, [input.clubId, input.userId, input.oldMainAddressId]);
  return true;
}
