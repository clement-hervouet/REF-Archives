/**
 * Requêtes SQL sur la table `access_request` (demandes d'accès, §15.4.4).
 *
 * Les demandes ne sont pas « à » un admin : tous les admins voient et traitent les mêmes.
 * L'exception au filtrage par propriétaire (§5.6) est donc assumée ici ; chaque appelant
 * vérifie le rôle admin (`requireAdmin`) avant de lire ou de décider.
 */
import { z } from "zod";
import type { Queryable } from "./users";

/** Au-delà, une nouvelle demande est ignorée en silence (anti-inondation de la liste). */
export const ACCESS_REQUEST_PENDING_LIMIT = 100;

export type AccessRequestDecision = "invited" | "refused";

export type NewAccessRequest = {
  /** Email déjà normalisé (voir `emailSchema`). */
  email: string;
  firstname: string;
  lastname: string;
};

/** Demande en attente, telle qu'affichée à l'admin. */
export type PendingAccessRequest = {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  createdAt: Date;
};

const pendingRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  created_at: z.date(),
});

const idRowSchema = z.object({ id: z.uuid() });
const lockedRowSchema = z.object({ id: z.uuid(), email: z.string() });
const countRowSchema = z.object({ count: z.number().int().nonnegative() });

// N'insère rien (0 ligne) si un compte existe déjà pour cet email, si une demande attend déjà
// pour lui (index unique partiel) ou si la liste d'attente est pleine. L'appelant répond
// pareil dans tous les cas : rien ne dit au visiteur lequel s'est produit (§6.1).
const INSERT_SQL = `INSERT INTO access_request (email, firstname, lastname)
SELECT $1::text, $2::text, $3::text
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE lower(email) = lower($1))
  AND (SELECT count(*) FROM access_request WHERE decided_at IS NULL) < $4::integer
ON CONFLICT (lower(email)) WHERE decided_at IS NULL DO NOTHING
RETURNING id`;

const LIST_PENDING_SQL = `SELECT id, email, firstname, lastname, created_at
FROM access_request
WHERE decided_at IS NULL
ORDER BY created_at, id
LIMIT $1`;

const COUNT_PENDING_SQL = `SELECT count(*)::integer AS count
FROM access_request
WHERE decided_at IS NULL`;

// Verrou de la ligne : deux admins qui cliquent « Inviter » en même temps ne créent pas deux
// invitations ; le second attend, puis ne trouve plus la demande en attente.
const LOCK_PENDING_SQL = `SELECT id, email
FROM access_request
WHERE id = $1 AND decided_at IS NULL
FOR UPDATE`;

const DECIDE_SQL = `UPDATE access_request
SET decided_at = now(), decided_by = $2, decision = $3
WHERE id = $1 AND decided_at IS NULL
RETURNING id`;

/**
 * Enregistre une demande. Renvoie `true` si elle a été créée, `false` si elle a été ignorée
 * (compte existant, demande déjà en attente, liste pleine) : à ne jamais montrer au visiteur.
 */
export async function insertAccessRequest(
  db: Queryable,
  request: NewAccessRequest,
): Promise<boolean> {
  const result = await db.query(INSERT_SQL, [
    request.email,
    request.firstname,
    request.lastname,
    ACCESS_REQUEST_PENDING_LIMIT,
  ]);
  return result.rows.length > 0;
}

/** Demandes en attente, de la plus ancienne à la plus récente. */
export async function listPendingAccessRequests(db: Queryable): Promise<PendingAccessRequest[]> {
  const result = await db.query(LIST_PENDING_SQL, [ACCESS_REQUEST_PENDING_LIMIT]);
  return result.rows.map((raw) => {
    const row = pendingRowSchema.parse(raw);
    return {
      id: row.id,
      email: row.email,
      firstname: row.firstname,
      lastname: row.lastname,
      createdAt: row.created_at,
    };
  });
}

/** Nombre de demandes en attente (pastille de la navigation). */
export async function countPendingAccessRequests(db: Queryable): Promise<number> {
  const result = await db.query(COUNT_PENDING_SQL, []);
  return countRowSchema.parse(result.rows[0]).count;
}

/**
 * Verrouille une demande encore en attente (dans une transaction) et renvoie son email,
 * ou `null` si elle n'existe pas ou a déjà été traitée.
 */
export async function lockPendingAccessRequest(
  db: Queryable,
  requestId: string,
): Promise<{ id: string; email: string } | null> {
  const result = await db.query(LOCK_PENDING_SQL, [requestId]);
  const row = result.rows[0];
  return row === undefined ? null : lockedRowSchema.parse(row);
}

/**
 * Clôt une demande en attente. Renvoie `false` si elle n'existe pas ou a déjà été traitée.
 */
export async function decideAccessRequest(
  db: Queryable,
  input: { requestId: string; adminId: string; decision: AccessRequestDecision },
): Promise<boolean> {
  const result = await db.query(DECIDE_SQL, [input.requestId, input.adminId, input.decision]);
  const row = result.rows[0];
  if (row === undefined) {
    return false;
  }
  idRowSchema.parse(row);
  return true;
}
