/**
 * Requêtes SQL sur la table `invitation`. Seule l'empreinte SHA-256 du jeton est
 * stockée : le jeton lui-même n'existe que dans le lien remis à l'invité.
 */
import { z } from "zod";
import type { Queryable } from "./users";

/** Durée de validité d'une invitation : 72 h (§6.1). */
export const INVITATION_TTL_SECONDS = 72 * 60 * 60;
export const INVITATION_LIST_LIMIT = 50;

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type CreatedInvitation = {
  id: string;
  email: string;
  expiresAt: Date;
};

/** Invitation encore utilisable (ni acceptée, ni révoquée, ni expirée). */
export type PendingInvitation = {
  id: string;
  email: string;
  expiresAt: Date;
};

export type InvitationSummary = {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  status: InvitationStatus;
};

export type CreateInvitationInput = {
  /** Email déjà normalisé (voir `emailSchema`). */
  email: string;
  /** SHA-256 du jeton (32 octets), jamais le jeton. */
  tokenHash: Buffer;
  /** Administrateur qui invite : propriétaire de l'invitation. */
  invitedBy: string;
};

const invitationRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  expires_at: z.date(),
});

const summaryRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  created_at: z.date(),
  expires_at: z.date(),
  accepted_at: z.date().nullable(),
  revoked_at: z.date().nullable(),
});

// Un seul lien valide par email : la nouvelle invitation annule les précédentes.
const REVOKE_PENDING_FOR_EMAIL_SQL = `UPDATE invitation
SET revoked_at = now()
WHERE lower(email) = lower($1) AND accepted_at IS NULL AND revoked_at IS NULL`;

// Insère seulement si aucun compte n'existe déjà pour cet email : renvoie alors 0 ligne.
const INSERT_INVITATION_SQL = `INSERT INTO invitation (email, token_hash, invited_by, expires_at)
SELECT $1::text, $2::bytea, $3::uuid, now() + $4::integer * interval '1 second'
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE lower(email) = lower($1))
RETURNING id, email, expires_at`;

// Les trois conditions d'une invitation utilisable vivent ici et nulle part ailleurs.
const FIND_PENDING_SQL = `SELECT id, email, expires_at
FROM invitation
WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;

const LOCK_PENDING_SQL = `${FIND_PENDING_SQL}
FOR UPDATE`;

const MARK_ACCEPTED_SQL = `UPDATE invitation
SET accepted_at = now()
WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
RETURNING id`;

const REVOKE_SQL = `UPDATE invitation
SET revoked_at = now()
WHERE id = $1 AND invited_by = $2 AND accepted_at IS NULL AND revoked_at IS NULL
RETURNING id`;

const LIST_SQL = `SELECT id, email, created_at, expires_at, accepted_at, revoked_at
FROM invitation
WHERE invited_by = $1
ORDER BY created_at DESC
LIMIT $2`;

/** Statut d'une invitation à un instant donné. */
export function getInvitationStatus(
  invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date,
): InvitationStatus {
  if (invitation.acceptedAt !== null) {
    return "accepted";
  }
  if (invitation.revokedAt !== null) {
    return "revoked";
  }
  return invitation.expiresAt.getTime() > now.getTime() ? "pending" : "expired";
}

/**
 * Crée une invitation (et révoque les précédentes du même email).
 * Renvoie `null` si un compte existe déjà pour cet email.
 * À appeler dans une transaction : les deux requêtes vont ensemble.
 */
export async function createInvitation(
  db: Queryable,
  input: CreateInvitationInput,
): Promise<CreatedInvitation | null> {
  await db.query(REVOKE_PENDING_FOR_EMAIL_SQL, [input.email]);
  const result = await db.query(INSERT_INVITATION_SQL, [
    input.email,
    input.tokenHash,
    input.invitedBy,
    INVITATION_TTL_SECONDS,
  ]);
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  const parsed = invitationRowSchema.parse(row);
  return { id: parsed.id, email: parsed.email, expiresAt: parsed.expires_at };
}

function toPending(row: Record<string, unknown> | undefined): PendingInvitation | null {
  if (row === undefined) {
    return null;
  }
  const parsed = invitationRowSchema.parse(row);
  return { id: parsed.id, email: parsed.email, expiresAt: parsed.expires_at };
}

/** Retrouve une invitation utilisable à partir de l'empreinte du jeton (lecture seule). */
export async function findPendingInvitation(
  db: Queryable,
  tokenHash: Buffer,
): Promise<PendingInvitation | null> {
  const result = await db.query(FIND_PENDING_SQL, [tokenHash]);
  return toPending(result.rows[0]);
}

/** Comme `findPendingInvitation`, mais verrouille la ligne (dans une transaction). */
export async function lockPendingInvitation(
  db: Queryable,
  tokenHash: Buffer,
): Promise<PendingInvitation | null> {
  const result = await db.query(LOCK_PENDING_SQL, [tokenHash]);
  return toPending(result.rows[0]);
}

/** Marque l'invitation comme acceptée. Renvoie `false` si elle n'est plus utilisable. */
export async function markInvitationAccepted(
  db: Queryable,
  invitationId: string,
): Promise<boolean> {
  const result = await db.query(MARK_ACCEPTED_SQL, [invitationId]);
  return result.rows.length > 0;
}

/**
 * Révoque une invitation en attente, à condition qu'elle appartienne à `invitedBy`.
 * Renvoie `false` si elle n'existe pas, n'est pas à lui ou n'est plus en attente.
 */
export async function revokeInvitation(
  db: Queryable,
  invitationId: string,
  invitedBy: string,
): Promise<boolean> {
  const result = await db.query(REVOKE_SQL, [invitationId, invitedBy]);
  return result.rows.length > 0;
}

/** Dernières invitations de l'administrateur, avec leur statut calculé à l'instant `now`. */
export async function listInvitations(
  db: Queryable,
  invitedBy: string,
  now: Date,
): Promise<InvitationSummary[]> {
  const result = await db.query(LIST_SQL, [invitedBy, INVITATION_LIST_LIMIT]);
  return result.rows.map((raw) => {
    const row = summaryRowSchema.parse(raw);
    return {
      id: row.id,
      email: row.email,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: getInvitationStatus(
        { acceptedAt: row.accepted_at, revokedAt: row.revoked_at, expiresAt: row.expires_at },
        now,
      ),
    };
  });
}