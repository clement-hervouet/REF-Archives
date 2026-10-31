/**
 * Requêtes SQL sur la table `rate_limit`. L'état est lu avec un verrou de ligne
 * (`FOR UPDATE`) : à appeler dans une transaction (voir `withTransaction`).
 */
import { z } from "zod";
import type { RateLimitState } from "../auth/rate-limit-policy";
import type { Queryable } from "./users";

const rateLimitRowSchema = z.object({
  key: z.string(),
  attempts: z.number().int(),
  strikes: z.number().int(),
  window_started_at: z.date(),
  blocked_until: z.date().nullable(),
});

// Crée les lignes manquantes pour que le verrou ci-dessous ait toujours quelque chose à verrouiller.
const ENSURE_ROWS_SQL = `INSERT INTO rate_limit (key)
SELECT unnest($1::text[])
ON CONFLICT (key) DO NOTHING`;

const LOCK_ROWS_SQL = `SELECT key, attempts, strikes, window_started_at, blocked_until
FROM rate_limit
WHERE key = ANY($1::text[])
ORDER BY key
FOR UPDATE`;

const SAVE_ROW_SQL = `UPDATE rate_limit
SET attempts = $2, strikes = $3, window_started_at = $4, blocked_until = $5, updated_at = now()
WHERE key = $1`;

const DELETE_ROW_SQL = `DELETE FROM rate_limit WHERE key = $1`;

/**
 * Verrouille (et crée si besoin) les lignes des clés données, puis renvoie leur état.
 * Les clés sont triées et dédoublonnées : toutes les transactions verrouillent dans
 * le même ordre, ce qui évite les interblocages.
 */
export async function lockRateLimits(
  db: Queryable,
  keys: string[],
): Promise<Map<string, RateLimitState>> {
  const sortedKeys = [...new Set(keys)].sort();
  await db.query(ENSURE_ROWS_SQL, [sortedKeys]);
  const result = await db.query(LOCK_ROWS_SQL, [sortedKeys]);

  const states = new Map<string, RateLimitState>();
  for (const raw of result.rows) {
    const row = rateLimitRowSchema.parse(raw);
    states.set(row.key, {
      attempts: row.attempts,
      strikes: row.strikes,
      windowStartedAt: row.window_started_at,
      blockedUntil: row.blocked_until,
    });
  }
  return states;
}

/** Enregistre le nouvel état d'une clé (la ligne doit avoir été verrouillée avant). */
export async function saveRateLimit(
  db: Queryable,
  key: string,
  state: RateLimitState,
): Promise<void> {
  await db.query(SAVE_ROW_SQL, [
    key,
    state.attempts,
    state.strikes,
    state.windowStartedAt,
    state.blockedUntil,
  ]);
}

/** Supprime le compteur d'une clé (succès de connexion). */
export async function deleteRateLimit(db: Queryable, key: string): Promise<void> {
  await db.query(DELETE_ROW_SQL, [key]);
}