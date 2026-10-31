/**
 * Requêtes SQL sur la table `session` : liste de révocation des JWT Auth.js.
 * L'horloge de référence est celle de PostgreSQL (`now()`), pour éviter tout décalage
 * entre plusieurs instances de l'application.
 */
import { z } from "zod";
import { userRoleSchema } from "./users";
import type { Queryable, UserRole } from "./users";

/** Durée de vie absolue d'une session : 30 jours (valeur par défaut, à valider). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type CreatedSession = {
  id: string;
  expiresAt: Date;
};

/** Session valide (non révoquée, non expirée) avec l'utilisateur associé. */
export type ActiveSession = {
  sessionId: string;
  userId: string;
  email: string;
  role: UserRole;
};

const createdSessionRowSchema = z.object({
  id: z.uuid(),
  expires_at: z.date(),
});

const activeSessionRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  email: z.string(),
  role: userRoleSchema,
});

const INSERT_SESSION_SQL = `INSERT INTO session (user_id, expires_at)
VALUES ($1, now() + $2::integer * interval '1 second')
RETURNING id, expires_at`;

// Les deux conditions de validité vivent ici et nulle part ailleurs.
const FIND_ACTIVE_SESSION_SQL = `SELECT s.id, s.user_id, u.email, u.role
FROM session s
JOIN "user" u ON u.id = s.user_id
WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`;

// Écriture limitée : au plus une mise à jour toutes les 5 minutes par session.
const TOUCH_SESSION_SQL = `UPDATE session
SET last_seen_at = now()
WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'`;

const REVOKE_SESSION_SQL = `UPDATE session
SET revoked_at = now()
WHERE id = $1 AND revoked_at IS NULL`;

const REVOKE_ALL_USER_SESSIONS_SQL = `UPDATE session
SET revoked_at = now()
WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)`;

/** Crée une session pour l'utilisateur. Son `id` est celui que le JWT portera. */
export async function createSession(db: Queryable, userId: string): Promise<CreatedSession> {
  const result = await db.query(INSERT_SESSION_SQL, [userId, SESSION_MAX_AGE_SECONDS]);
  const row = createdSessionRowSchema.parse(result.rows[0]);
  return { id: row.id, expiresAt: row.expires_at };
}

/** Renvoie la session si elle est valide, sinon `null` (inconnue, révoquée ou expirée). */
export async function findActiveSession(
  db: Queryable,
  sessionId: string,
): Promise<ActiveSession | null> {
  const result = await db.query(FIND_ACTIVE_SESSION_SQL, [sessionId]);
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  const parsed = activeSessionRowSchema.parse(row);
  return {
    sessionId: parsed.id,
    userId: parsed.user_id,
    email: parsed.email,
    role: parsed.role,
  };
}

/** Met à jour `last_seen_at` (limité à une écriture toutes les 5 minutes). */
export async function touchSession(db: Queryable, sessionId: string): Promise<void> {
  await db.query(TOUCH_SESSION_SQL, [sessionId]);
}

/** Révoque une session (déconnexion). Sans effet si elle est déjà révoquée. */
export async function revokeSession(db: Queryable, sessionId: string): Promise<void> {
  await db.query(REVOKE_SESSION_SQL, [sessionId]);
}

/**
 * Révoque toutes les sessions d'un utilisateur (changement de mot de passe, §6.1).
 * `exceptSessionId` permet de garder la session courante ; `null` révoque tout.
 */
export async function revokeAllUserSessions(
  db: Queryable,
  userId: string,
  exceptSessionId: string | null,
): Promise<void> {
  await db.query(REVOKE_ALL_USER_SESSIONS_SQL, [userId, exceptSessionId]);
}