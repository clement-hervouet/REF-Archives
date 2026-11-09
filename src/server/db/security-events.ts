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
  "password_reset_requested",
  "password_reset_completed",
  "calendar_feed_created",
  "calendar_feed_revoked",
  // Actions d'un admin sur un compte (bloc 10, migration 018).
  "account_updated",
  "account_blocked",
  "account_unblocked",
  "account_password_reset_sent",
  "account_deletion_scheduled",
  "account_deletion_cancelled",
  "account_deleted",
]);
export type SecurityEventType = z.infer<typeof securityEventTypeSchema>;

export type SecurityEvent = {
  type: SecurityEventType;
  /** Utilisateur concerné, ou `null` s'il est inconnu. */
  userId: string | null;
  /** Empreinte HMAC de l'IP (64 caractères hexadécimaux), jamais l'IP. */
  ipHash: string | null;
  /** Compte visé par une action d'admin (`userId` est alors l'admin), sinon absent. */
  targetUserId?: string | null;
};

const INSERT_SECURITY_EVENT_SQL = `INSERT INTO security_event (type, user_id, ip_hash, target_user_id)
VALUES ($1, $2, $3, $4)`;

export async function insertSecurityEvent(db: Queryable, event: SecurityEvent): Promise<void> {
  await db.query(INSERT_SECURITY_EVENT_SQL, [
    event.type,
    event.userId,
    event.ipHash,
    event.targetUserId ?? null,
  ]);
}
