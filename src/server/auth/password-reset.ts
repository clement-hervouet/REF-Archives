/**
 * Logique métier du reset de mot de passe : demande puis validation du lien.
 * Les dépendances (transaction, hash, rate limiting) sont injectées : testable sans base.
 */
import { passwordSchema, tokenSchema } from "@/lib/schemas/auth";
import {
  createPasswordReset,
  deletePendingPasswordResets,
  lockPendingPasswordReset,
  markPasswordResetUsed,
} from "../db/password-resets";
import { revokeAllUserSessions } from "../db/sessions";
import { findUserIdByEmail, updateUserPasswordHash } from "../db/users";
import type { Queryable } from "../db/users";
import { hashIdentifier } from "./rate-limit";
import type { AttemptDecision } from "./rate-limit";
import { hashToken } from "./tokens";
import type { GeneratedToken } from "./tokens";

/** Exécute `action` dans une transaction (COMMIT si elle réussit, ROLLBACK si elle lève). */
type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

// ─── Demande ───────────────────────────────────────────────────────────────

export type RequestPasswordResetDeps = {
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  generateToken: () => GeneratedToken;
  transaction: Transaction;
  now: () => Date;
};

export type RequestPasswordResetResult =
  | {
      status: "issued";
      userId: string;
      email: string;
      /** À envoyer par email ; jamais stocké ni journalisé. */
      token: string;
      expiresAt: Date;
    }
  // Interne : l'appelant répond pareil qu'un compte existe ou non (§6.1, pas d'énumération).
  | { status: "no_account" }
  | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * Crée un jeton de reset si un compte existe pour cet email (déjà normalisé).
 * La tentative est comptée AVANT la recherche du compte, qu'il existe ou non : le
 * comportement du rate limiting ne révèle donc rien.
 */
export async function requestPasswordReset(
  deps: RequestPasswordResetDeps,
  input: { email: string; ip: string },
): Promise<RequestPasswordResetResult> {
  // Clés hachées : jamais d'IP ni d'email en clair dans la table `rate_limit`.
  const decision = await deps.admitAttempt(
    [
      `reset-request:ip:${hashIdentifier(input.ip)}`,
      `reset-request:account:${hashIdentifier(input.email)}`,
    ],
    deps.now(),
  );
  if (!decision.admitted) {
    return { status: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
  }

  const issued = await deps.transaction(async (db) => {
    const userId = await findUserIdByEmail(db, input.email);
    if (userId === null) {
      return null;
    }
    await deletePendingPasswordResets(db, userId);
    const { token, hash } = deps.generateToken();
    const created = await createPasswordReset(db, { userId, tokenHash: hash });
    return { userId, token, expiresAt: created.expiresAt };
  });
  if (issued === null) {
    return { status: "no_account" };
  }
  return { status: "issued", email: input.email, ...issued };
}

// ─── Validation du lien ────────────────────────────────────────────────────

export type ResetPasswordDeps = {
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  hashPassword: (password: string) => Promise<string>;
  transaction: Transaction;
  now: () => Date;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
  /** IP du client telle que transmise par le reverse proxy. */
  ip: string;
};

export type ResetPasswordResult =
  | { status: "reset"; userId: string }
  // Lien inconnu, expiré ou déjà utilisé : volontairement indiscernables (§6.1).
  | { status: "invalid_link" }
  | { status: "invalid_password"; issues: string[] }
  | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * Consomme le jeton, change le mot de passe et révoque toutes les sessions, dans la
 * transaction de l'appelant. La ligne est verrouillée : deux validations simultanées
 * du même lien ne passent pas.
 */
async function consumeReset(
  deps: ResetPasswordDeps,
  db: Queryable,
  tokenHash: Buffer,
  password: string,
): Promise<ResetPasswordResult> {
  const reset = await lockPendingPasswordReset(db, tokenHash);
  if (reset === null) {
    return { status: "invalid_link" };
  }
  if (!(await markPasswordResetUsed(db, reset.id))) {
    return { status: "invalid_link" };
  }
  const passwordHash = await deps.hashPassword(password);
  if (!(await updateUserPasswordHash(db, reset.userId, passwordHash))) {
    return { status: "invalid_link" };
  }
  // D'éventuels autres jetons du compte (demandes simultanées) n'ont plus lieu d'être.
  await deletePendingPasswordResets(db, reset.userId);
  // Changement de mot de passe : toutes les sessions sont invalidées (§6.1).
  await revokeAllUserSessions(db, reset.userId, null);
  return { status: "reset", userId: reset.userId };
}

/**
 * Valide un lien de reset et change le mot de passe. Les entrées mal formées sont
 * refusées avant tout accès à la base et ne comptent pas dans le rate limiting.
 */
export async function resetPassword(
  deps: ResetPasswordDeps,
  input: ResetPasswordInput,
): Promise<ResetPasswordResult> {
  const token = tokenSchema.safeParse(input.token);
  if (!token.success) {
    return { status: "invalid_link" };
  }
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) {
    return { status: "invalid_password", issues: password.error.issues.map((i) => i.message) };
  }

  const decision = await deps.admitAttempt(
    [`reset:ip:${hashIdentifier(input.ip)}`, `reset:token:${hashIdentifier(token.data)}`],
    deps.now(),
  );
  if (!decision.admitted) {
    return { status: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
  }

  return deps.transaction((db) =>
    consumeReset(deps, db, hashToken(token.data), password.data),
  );
}