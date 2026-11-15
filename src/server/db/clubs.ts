/**
 * Clubs et adresses d'un utilisateur : listes du formulaire d'indemnité (bloc 6) et
 * gestion des fiches dans l'onglet « Clubs » (§15.4.1). Toujours filtré par
 * propriétaire (§6.2).
 *
 * Une adresse de club peut être partielle : le code postal est obligatoire, la rue et la
 * ville facultatives (migration 022). Modifier l'adresse d'un club met à jour sa ligne
 * `address` en place : les indemnités et matchs qui la référencent (matchs à domicile du
 * club) suivent donc l'adresse complétée.
 */
import { z } from "zod";
import type { ClubFormValue } from "@/lib/schemas/clubs";
import { MAX_CLUBS_PER_USER } from "./compensation-writes";
import type { Queryable } from "./users";

export type AddressSummary = {
  id: string;
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
  /** Adresse du club : adresse par défaut d'un match où il reçoit (équipe 1). */
  address: AddressSummary;
};

const addressRowSchema = z.object({
  id: z.uuid(),
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
  street: z.string().nullable(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
});

const LIST_CLUBS_SQL = `SELECT c.id, c.name, a.id AS address_id, a.street, a.number, a.postal_code, a.city,
  a.country
FROM club c
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
WHERE c.user_id = $1
ORDER BY lower(c.name), lower(a.city) NULLS LAST, a.postal_code, c.id`;

const LIST_ADDRESSES_SQL = `SELECT id, street, number, postal_code, city, country
FROM address
WHERE user_id = $1
ORDER BY lower(city) NULLS LAST, postal_code, lower(street) NULLS LAST, number`;

/** Clubs de l'utilisateur avec leur adresse, par ordre alphabétique. */
export async function listClubs(db: Queryable, userId: string): Promise<ClubSummary[]> {
  const result = await db.query(LIST_CLUBS_SQL, [userId]);
  return result.rows.map((raw) => {
    const row = clubRowSchema.parse(raw);
    return {
      id: row.id,
      name: row.name,
      address: {
        id: row.address_id,
        street: row.street,
        number: row.number,
        postalCode: row.postal_code,
        city: row.city,
        country: row.country,
      },
    };
  });
}

/** Adresses connues de l'utilisateur (clubs et salles), par ville puis rue. */
export async function listAddresses(db: Queryable, userId: string): Promise<AddressSummary[]> {
  const result = await db.query(LIST_ADDRESSES_SQL, [userId]);
  return result.rows.map((raw) => {
    const row = addressRowSchema.parse(raw);
    return {
      id: row.id,
      street: row.street,
      number: row.number,
      postalCode: row.postal_code,
      city: row.city,
      country: row.country,
    };
  });
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
  SELECT (SELECT count(*) FROM club WHERE user_id = $1::uuid) < $8::integer AS ok
),
new_address AS (
  INSERT INTO address (user_id, street, number, postal_code, city, country)
  SELECT $1::uuid, $3::text, $4::text, $5::text, $6::text, $7::text FROM allowed WHERE ok
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
SET street = $4, number = $5, postal_code = $6, city = $7, country = $8
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

// L'adresse du club supprimé part aussi si plus rien ne la cite (sinon elle encombrerait
// la liste des adresses connues). Une salle choisie par un match la garde.
const DELETE_UNUSED_ADDRESS_SQL = `DELETE FROM address a
WHERE a.id = $1 AND a.user_id = $2
  AND NOT EXISTS (SELECT 1 FROM club c WHERE c.address_id = a.id AND c.user_id = a.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM compensation x WHERE x.address_id = a.id AND x.user_id = a.user_id
  )
  AND NOT EXISTS (SELECT 1 FROM game g WHERE g.address_id = a.id AND g.user_id = a.user_id)
  AND NOT EXISTS (SELECT 1 FROM person p WHERE p.address_id = a.id AND p.user_id = a.user_id)`;

function clubParams(club: ClubFormValue): (string | null)[] {
  return [club.name, club.street, club.number, club.postalCode, club.city, club.country];
}

/** Crée un club avec son adresse. `null` si l'utilisateur a atteint la limite de clubs. */
export async function insertClubWithAddress(
  db: Queryable,
  input: { userId: string; club: ClubFormValue },
): Promise<string | null> {
  const result = await db.query(INSERT_CLUB_WITH_ADDRESS_SQL, [
    input.userId,
    ...clubParams(input.club),
    MAX_CLUBS_PER_USER,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
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
 * Supprime un club qu'aucune indemnité ni aucun match ne cite, puis son adresse si elle
 * n'est plus utilisée. À appeler dans une transaction.
 */
export async function deleteClub(
  db: Queryable,
  input: { userId: string; clubId: string },
): Promise<DeleteClubResult> {
  const deleted = await db.query(DELETE_CLUB_SQL, [input.clubId, input.userId]);
  const row = deleted.rows[0];
  if (row !== undefined) {
    const { address_id: addressId } = addressIdRowSchema.parse(row);
    await db.query(DELETE_UNUSED_ADDRESS_SQL, [addressId, input.userId]);
    return "deleted";
  }
  return (await isOwnedClub(db, input)) ? "in_use" : "not_found";
}
