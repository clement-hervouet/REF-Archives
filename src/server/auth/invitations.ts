/**
 * Logique métier des invitations : création par un admin, acceptation par l'invité.
 * Les dépendances (transaction, hash, rate limiting) sont injectées : testable sans base.
 */
import { passwordSchema, tokenSchema } from "@/lib/schemas/auth";
import { createInvitation, lockPendingInvitation, markInvitationAccepted } from "../db/invitations";
import { EmailAlreadyUsedError, createUser } from "../db/users";
import type { Queryable } from "../db/users";
import { hashIdentifier } from "./rate-limit";
import type { AttemptDecision } from "./rate-limit";
import { hashToken } from "./tokens";
import type { GeneratedToken } from "./tokens";

/** Exécute `action` dans une transaction (COMMIT si elle réussit, ROLLBACK si elle lève). */
type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

// ─── Création (admin) ──────────────────────────────────────────────────────

export type CreateInvitationDeps = {
  generateToken: () => GeneratedToken;
  transaction: Transaction;
};

export type CreateInvitationResult =
  | {
      status: "created";
      invitationId: string;
      /** À afficher une seule fois à l'admin ; jamais stocké ni journalisé. */
      token: string;
      expiresAt: Date;
    }
  | { status: "email_taken" };

/** Crée l'invitation et renvoie le jeton à intégrer dans le lien. L'email doit être normalisé. */
export async function createInvitationForEmail(
  deps: CreateInvitationDeps,
  input: { email: string; invitedBy: string },
): Promise<CreateInvitationResult> {
  const { token, hash } = deps.generateToken();
  const created = await deps.transaction((db) =>
    createInvitation(db, { email: input.email, tokenHash: hash, invitedBy: input.invitedBy }),
  );
  if (created === null) {
    return { status: "email_taken" };
  }
  return { status: "created", invitationId: created.id, token, expiresAt: created.expiresAt };
}

// ─── Acceptation (invité) ──────────────────────────────────────────────────

export type AcceptInvitationDeps = {
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  hashPassword: (password: string) => Promise<string>;
  transaction: Transaction;
  now: () => Date;
};

export type AcceptInvitationInput = {
  token: string;
  password: string;
  /** IP du client telle que transmise par le reverse proxy. */
  ip: string;
};

export type AcceptInvitationResult =
  | { status: "created"; userId: string; email: string }
  // Lien inconnu, expiré, déjà utilisé ou révoqué : volontairement indiscernables (§6.1).
  | { status: "invalid_invitation" }
  | { status: "invalid_password"; issues: string[] }
  | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * Marque l'invitation acceptée puis crée le compte, dans la transaction de l'appelant.
 * La ligne d'invitation est verrouillée : deux acceptations simultanées ne passent pas.
 */
async function consumeInvitation(
  deps: AcceptInvitationDeps,
  db: Queryable,
  tokenHash: Buffer,
  password: string,
): Promise<AcceptInvitationResult> {
  const invitation = await lockPendingInvitation(db, tokenHash);
  if (invitation === null) {
    return { status: "invalid_invitation" };
  }
  if (!(await markInvitationAccepted(db, invitation.id))) {
    return { status: "invalid_invitation" };
  }
  const passwordHash = await deps.hashPassword(password);
  // L'email vient de l'invitation, jamais de l'invité.
  const user = await createUser(db, { email: invitation.email, passwordHash, role: "user" });
  return { status: "created", userId: user.id, email: user.email };
}

/**
 * Accepte une invitation et crée le compte. Les entrées mal formées sont refusées
 * avant tout accès à la base et ne comptent pas dans le rate limiting.
 */
export async function acceptInvitation(
  deps: AcceptInvitationDeps,
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  const token = tokenSchema.safeParse(input.token);
  if (!token.success) {
    return { status: "invalid_invitation" };
  }
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) {
    return { status: "invalid_password", issues: password.error.issues.map((i) => i.message) };
  }

  // Clés hachées : jamais d'IP ni de jeton en clair dans la table `rate_limit`.
  const decision = await deps.admitAttempt(
    [`invitation:ip:${hashIdentifier(input.ip)}`, `invitation:token:${hashIdentifier(token.data)}`],
    deps.now(),
  );
  if (!decision.admitted) {
    return { status: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
  }

  try {
    return await deps.transaction((db) =>
      consumeInvitation(deps, db, hashToken(token.data), password.data),
    );
  } catch (error: unknown) {
    // Un compte a été créé avec cet email entre-temps : la transaction est annulée.
    if (error instanceof EmailAlreadyUsedError) {
      return { status: "invalid_invitation" };
    }
    throw error;
  }
}