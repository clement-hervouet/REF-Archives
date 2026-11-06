/**
 * Lecture des clubs et adresses d'un utilisateur, pour les listes du formulaire
 * d'indemnité (bloc 6). Toujours filtrée par propriétaire (§6.2).
 */
import { z } from "zod";
import type { Queryable } from "./users";

export type AddressSummary = {
  id: string;
  street: string;
  number: string | null;
  postalCode: string;
  city: string;
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
  street: z.string(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string(),
  country: z.string().nullable(),
});

const clubRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address_id: z.uuid(),
  street: z.string(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string(),
  country: z.string().nullable(),
});

const LIST_CLUBS_SQL = `SELECT c.id, c.name, a.id AS address_id, a.street, a.number, a.postal_code, a.city,
  a.country
FROM club c
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
WHERE c.user_id = $1
ORDER BY lower(c.name), lower(a.city)`;

const LIST_ADDRESSES_SQL = `SELECT id, street, number, postal_code, city, country
FROM address
WHERE user_id = $1
ORDER BY lower(city), lower(street), number`;

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
