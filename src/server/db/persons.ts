/**
 * Requêtes SQL des personnes (bloc 9) : la fiche « moi » et les collègues.
 *
 * Un collègue est une fiche nom seul, propre à l'utilisateur (§3.8, §3.11) : la case
 * `has_account` est informative, aucune requête ne cherche ni ne relie un autre compte
 * (§6.5 : pas d'oracle d'existence de compte). Chaque requête filtre sur `user_id`.
 */
import { z } from "zod";
import type { Queryable } from "./users";

/** Limite anti-abus (application potentiellement publique). */
export const MAX_COLLEAGUES_PER_USER = 1000;

/** Personne telle qu'affichée parmi les officiels d'un match. */
export type PersonSummary = {
  id: string;
  /** Vrai pour la fiche de l'utilisateur lui-même, affichée « Moi ». */
  isSelf: boolean;
  firstname: string | null;
  lastname: string | null;
  hasAccount: boolean;
};

export type Colleague = {
  id: string;
  firstname: string | null;
  lastname: string;
  hasAccount: boolean;
};

export type NewColleague = {
  firstname: string | null;
  lastname: string;
  hasAccount: boolean;
};

export const personSummaryRowSchema = z.object({
  id: z.uuid(),
  is_self: z.boolean(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  has_account: z.boolean(),
});

export function toPersonSummary(row: z.infer<typeof personSummaryRowSchema>): PersonSummary {
  return {
    id: row.id,
    isSelf: row.is_self,
    firstname: row.firstname,
    lastname: row.lastname,
    hasAccount: row.has_account,
  };
}

const idRowSchema = z.object({ id: z.uuid() });
const nullableIdRowSchema = z.object({ id: z.uuid().nullable() });

// ─── Fiche « moi » ──────────────────────────────────────────────────────────

// Créée au premier besoin. La cible du ON CONFLICT reprend l'index partiel
// `person_one_self_per_user_key` : deux appels simultanés ne créent qu'une fiche.
const INSERT_SELF_SQL = `INSERT INTO person (user_id, type, is_self)
VALUES ($1, 'referee', true)
ON CONFLICT (user_id) WHERE is_self DO NOTHING`;

const FIND_SELF_SQL = `SELECT id FROM person WHERE user_id = $1 AND is_self`;

/** Identifiant de la fiche « moi » de l'utilisateur, créée si besoin. */
export async function ensureSelfPerson(db: Queryable, userId: string): Promise<string> {
  await db.query(INSERT_SELF_SQL, [userId]);
  const result = await db.query(FIND_SELF_SQL, [userId]);
  return idRowSchema.parse(result.rows[0]).id;
}

// ─── Collègues ──────────────────────────────────────────────────────────────

const colleagueRowSchema = z.object({
  id: z.uuid(),
  firstname: z.string().nullable(),
  lastname: z.string(),
  has_account: z.boolean(),
});

function toColleague(row: z.infer<typeof colleagueRowSchema>): Colleague {
  return {
    id: row.id,
    firstname: row.firstname,
    lastname: row.lastname,
    hasAccount: row.has_account,
  };
}

// Tri insensible à la casse ; un collègue a toujours un nom (CHECK person_name_check).
const LIST_COLLEAGUES_SQL = `SELECT id, firstname, lastname, has_account
FROM person
WHERE user_id = $1 AND NOT is_self
ORDER BY lower(lastname), lower(coalesce(firstname, '')), id`;

const OWNED_COLLEAGUES_SQL = `SELECT id FROM person
WHERE id = ANY($1::uuid[]) AND user_id = $2 AND NOT is_self`;

// Ne lève jamais d'erreur de limite : id NULL = limite atteinte.
const INSERT_COLLEAGUE_SQL = `WITH allowed AS (
  SELECT (
    SELECT count(*) FROM person WHERE user_id = $1::uuid AND NOT is_self
  ) < $5::integer AS ok
),
inserted AS (
  INSERT INTO person (user_id, type, is_self, firstname, lastname, has_account)
  SELECT $1::uuid, 'referee', false, $2::text, $3::text, $4::boolean FROM allowed WHERE ok
  RETURNING id
)
SELECT (SELECT id FROM inserted) AS id`;

const UPDATE_COLLEAGUE_SQL = `UPDATE person
SET firstname = $3, lastname = $4, has_account = $5
WHERE id = $1 AND user_id = $2 AND NOT is_self
RETURNING id`;

// Les FK des matchs sont en NO ACTION : une fiche encore citée (même par un match supprimé
// en attente de purge) n'est pas supprimée. Le NOT EXISTS répond « utilisée » proprement
// au lieu de laisser échouer la contrainte.
const DELETE_COLLEAGUE_SQL = `DELETE FROM person p
WHERE p.id = $1 AND p.user_id = $2 AND NOT p.is_self
  AND NOT EXISTS (
    SELECT 1 FROM game g
    WHERE g.user_id = p.user_id
      AND p.id IN (g.referee1_id, g.referee2_id, g.referee3_id, g.observer_id)
  )
RETURNING id`;

const COLLEAGUE_EXISTS_SQL = `SELECT id FROM person WHERE id = $1 AND user_id = $2 AND NOT is_self`;

/** Collègues de l'utilisateur, par nom puis prénom. */
export async function listColleagues(db: Queryable, userId: string): Promise<Colleague[]> {
  const result = await db.query(LIST_COLLEAGUES_SQL, [userId]);
  return result.rows.map((raw) => toColleague(colleagueRowSchema.parse(raw)));
}

/**
 * Parmi `personIds`, ceux qui sont des collègues de l'utilisateur. La fiche « moi » n'en
 * fait pas partie : elle ne peut pas être choisie comme collègue.
 */
export async function findOwnedColleagueIds(
  db: Queryable,
  input: { userId: string; personIds: readonly string[] },
): Promise<Set<string>> {
  if (input.personIds.length === 0) {
    return new Set();
  }
  const result = await db.query(OWNED_COLLEAGUES_SQL, [input.personIds, input.userId]);
  return new Set(result.rows.map((raw) => idRowSchema.parse(raw).id));
}

/** Crée un collègue. `null` si l'utilisateur a atteint la limite de collègues. */
export async function insertColleague(
  db: Queryable,
  input: { userId: string; colleague: NewColleague },
): Promise<string | null> {
  const { colleague } = input;
  const result = await db.query(INSERT_COLLEAGUE_SQL, [
    input.userId,
    colleague.firstname,
    colleague.lastname,
    colleague.hasAccount,
    MAX_COLLEAGUES_PER_USER,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id;
}

/** Modifie un collègue de l'utilisateur. Faux s'il est introuvable. */
export async function updateColleague(
  db: Queryable,
  input: { userId: string; personId: string; colleague: NewColleague },
): Promise<boolean> {
  const { colleague } = input;
  const result = await db.query(UPDATE_COLLEAGUE_SQL, [
    input.personId,
    input.userId,
    colleague.firstname,
    colleague.lastname,
    colleague.hasAccount,
  ]);
  return result.rows.length > 0;
}

export type DeleteColleagueResult = "deleted" | "in_use" | "not_found";

/** Supprime un collègue qu'aucun match ne cite. */
export async function deleteColleague(
  db: Queryable,
  input: { userId: string; personId: string },
): Promise<DeleteColleagueResult> {
  const params = [input.personId, input.userId];
  const deleted = await db.query(DELETE_COLLEAGUE_SQL, params);
  if (deleted.rows.length > 0) {
    return "deleted";
  }
  const exists = await db.query(COLLEAGUE_EXISTS_SQL, params);
  return exists.rows.length > 0 ? "in_use" : "not_found";
}
