/**
 * Requêtes SQL sur la table `password_reset`. Seule l'empreinte SHA-256 du jeton est
 * stockée : le jeton lui-même n'existe que dans le lien envoyé par email.
 */
import { z } from "zod";
import type { Queryable } from "./users";

/** Durée de validité d'un lien de réinitialisation : 30 minutes (§6.1 : courte durée). */
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

export type CreatedPasswordReset = {
  id: string;
  expiresAt: Date;
};

/** Demande encore utilisable (ni utilisée, ni expirée). */
export type PendingPasswordReset = {
  id: string;
  userId: string;
  expiresAt: Date;
};

const createdRowSchema = z.object({
  id: z.uuid(),
  expires_at: z.date(),
});

const pendingRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  expires_at: z.date(),
});

// Un seul jeton actif par compte : on supprime les demandes en attente avant d'en créer une.
const DELETE_PENDING_SQL = `DELETE FROM password_reset
WHERE user_id = $1 AND used_at IS NULL`;

const INSERT_SQL = `INSERT INTO password_reset (user_id, token_hash, expires_at)
VALUES ($1, $2, now() + $3::integer * interval '1 second')
RETURNING id, expires_at`;

// Les deux conditions d'une demande utilisable vivent ici et nulle part ailleurs.
const FIND_PENDING_SQL = `SELECT id, user_id, expires_at
FROM password_reset
WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`;

const LOCK_PENDING_SQL = `${FIND_PENDING_SQL}
FOR UPDATE`;

const MARK_USED_SQL = `UPDATE password_reset
SET used_at = now()
WHERE id = $1 AND used_at IS NULL AND expires_at > now()
RETURNING id`;

function toPending(row: Record<string, unknown> | undefined): PendingPasswordReset | null {
  if (row === undefined) {
    return null;
  }
  const parsed = pendingRowSchema.parse(row);
  return { id: parsed.id, userId: parsed.user_id, expiresAt: parsed.expires_at };
}

/** Supprime les demandes en attente d'un utilisateur (nouvelle demande, ou reset réussi). */
export async function deletePendingPasswordResets(db: Queryable, userId: string): Promise<void> {
  await db.query(DELETE_PENDING_SQL, [userId]);
}

/** Crée une demande de réinitialisation. À appeler dans une transaction. */
export async function createPasswordReset(
  db: Queryable,
  input: { userId: string; tokenHash: Buffer },
): Promise<CreatedPasswordReset> {
  const result = await db.query(INSERT_SQL, [
    input.userId,
    input.tokenHash,
    PASSWORD_RESET_TTL_SECONDS,
  ]);
  const row = createdRowSchema.parse(result.rows[0]);
  return { id: row.id, expiresAt: row.expires_at };
}

/** Retrouve une demande utilisable à partir de l'empreinte du jeton (lecture seule). */
export async function findPendingPasswordReset(
  db: Queryable,
  tokenHash: Buffer,
): Promise<PendingPasswordReset | null> {
  const result = await db.query(FIND_PENDING_SQL, [tokenHash]);
  return toPending(result.rows[0]);
}

/** Comme `findPendingPasswordReset`, mais verrouille la ligne (dans une transaction). */
export async function lockPendingPasswordReset(
  db: Queryable,
  tokenHash: Buffer,
): Promise<PendingPasswordReset | null> {
  const result = await db.query(LOCK_PENDING_SQL, [tokenHash]);
  return toPending(result.rows[0]);
}

/** Marque la demande comme utilisée. Renvoie `false` si elle n'est plus utilisable. */
export async function markPasswordResetUsed(db: Queryable, resetId: string): Promise<boolean> {
  const result = await db.query(MARK_USED_SQL, [resetId]);
  return result.rows.length > 0;
}