/**
 * Requêtes SQL du lien d'abonnement iCal (bloc 8, table `calendar_feed`).
 *
 * Un seul lien par compte. Seule l'empreinte SHA-256 du jeton est stockée (voir
 * `src/server/auth/tokens.ts`) : l'URL complète n'est montrée qu'une fois, à sa création.
 */
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { TOKEN_BYTES } from "../auth/tokens";
import type { Queryable } from "./users";

export type CalendarFeedStatus = {
  /** Date de création (ou de dernière régénération) du lien. */
  createdAt: Date;
};

const createdAtRowSchema = z.object({ created_at: z.date() });
const userIdRowSchema = z.object({ user_id: z.uuid() });

// Régénérer = remplacer l'empreinte : l'ancienne URL cesse de fonctionner dans la même instruction.
const UPSERT_FEED_SQL = `INSERT INTO calendar_feed (user_id, token_hash)
VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now()
RETURNING created_at`;

const DELETE_FEED_SQL = `DELETE FROM calendar_feed WHERE user_id = $1 RETURNING user_id`;

const GET_STATUS_SQL = `SELECT created_at FROM calendar_feed WHERE user_id = $1`;

const FIND_USER_BY_TOKEN_SQL = `SELECT user_id FROM calendar_feed WHERE token_hash = $1`;

function assertTokenHash(tokenHash: Buffer): void {
  // Garde-fou : on ne stocke ni ne cherche jamais autre chose qu'une empreinte SHA-256.
  if (tokenHash.length !== TOKEN_BYTES) {
    throw new ValidationError("invalid_token_hash");
  }
}

/** Crée le lien du compte, ou le remplace s'il existe. Renvoie sa date de création. */
export async function replaceCalendarFeed(
  db: Queryable,
  input: { userId: string; tokenHash: Buffer },
): Promise<CalendarFeedStatus> {
  assertTokenHash(input.tokenHash);
  const result = await db.query(UPSERT_FEED_SQL, [input.userId, input.tokenHash]);
  return { createdAt: createdAtRowSchema.parse(result.rows[0]).created_at };
}

/** Révoque le lien du compte. Renvoie `false` s'il n'y en avait pas. */
export async function deleteCalendarFeed(db: Queryable, userId: string): Promise<boolean> {
  const result = await db.query(DELETE_FEED_SQL, [userId]);
  return result.rows.length > 0;
}

/** État du lien du compte, ou `null` s'il n'en a pas. */
export async function getCalendarFeedStatus(
  db: Queryable,
  userId: string,
): Promise<CalendarFeedStatus | null> {
  const result = await db.query(GET_STATUS_SQL, [userId]);
  const row = result.rows[0];
  return row === undefined ? null : { createdAt: createdAtRowSchema.parse(row).created_at };
}

/** Compte propriétaire du lien dont le jeton a cette empreinte, ou `null`. */
export async function findUserIdByCalendarToken(
  db: Queryable,
  tokenHash: Buffer,
): Promise<string | null> {
  assertTokenHash(tokenHash);
  const result = await db.query(FIND_USER_BY_TOKEN_SQL, [tokenHash]);
  const row = result.rows[0];
  return row === undefined ? null : userIdRowSchema.parse(row).user_id;
}
