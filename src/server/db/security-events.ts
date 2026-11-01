/**
 * Requêtes SQL sur la table `security_event` (journal de sécurité, §6.1).
 */
import { z } from "zod";
import type { Queryable } from "./users";

export const securityEventTypeSchema = z.enum([
  "login_succeeded",
  "login_failed",
  "logout",
  "invitation_created",
  "invitation_revoked",
  "invitation_accepted",
  "invitation_rejected",
]);
export type SecurityEventType = z.infer<typeof securityEventTypeSchema>;

export type SecurityEvent = {
  type: SecurityEventType;
  /** Utilisateur concerné, ou `null` s'il est inconnu. */
  userId: string | null;
  /** Empreinte HMAC de l'IP (64 caractères hexadécimaux), jamais l'IP. */
  ipHash: string | null;
};

const INSERT_SECURITY_EVENT_SQL = `INSERT INTO security_event (type, user_id, ip_hash)
VALUES ($1, $2, $3)`;

export async function insertSecurityEvent(db: Queryable, event: SecurityEvent): Promise<void> {
  await db.query(INSERT_SECURITY_EVENT_SQL, [event.type, event.userId, event.ipHash]);
}