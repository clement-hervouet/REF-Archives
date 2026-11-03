/**
 * Branche la logique de connexion (`login.ts`) sur la vraie base et le vrai hash.
 */
import { getDb, withTransaction } from "../db/pool";
import { deleteRateLimit, lockRateLimits, saveRateLimit } from "../db/rate-limits";
import { createSession } from "../db/sessions";
import { findUserCredentialsByEmail } from "../db/users";
import type { Queryable } from "../db/users";
import { sendEmail } from "../email/mailer";
import { sendAccountLockedAlert } from "../email/security-alert-email";
import type { AccountBlockedEvent, LoginDeps } from "./login";
import { verifyAgainstDummyHash, verifyPassword } from "./password";
import { admitAttempt } from "./rate-limit";
import type { AttemptDecision, RateLimitStore } from "./rate-limit";

function storeFor(transaction: Queryable): RateLimitStore {
  return {
    lock: (keys) => lockRateLimits(transaction, keys),
    save: (key, state) => saveRateLimit(transaction, key, state),
  };
}

/**
 * Décide d'admettre une tentative : verrouillage et incrément dans une seule
 * transaction (voir `rate-limit.ts`). Partagée par la connexion et les invitations.
 */
export function admitAttemptInTransaction(keys: string[], now: Date): Promise<AttemptDecision> {
  return withTransaction((transaction) => admitAttempt(storeFor(transaction), keys, now));
}

/**
 * Envoie l'alerte « connexions suspendues » sans être attendue : `sendAccountLockedAlert`
 * ne rejette jamais, et la réponse de connexion ne dépend donc pas de l'envoi.
 */
function alertAccountBlocked({ email, retryAfterSeconds }: AccountBlockedEvent): void {
  void sendAccountLockedAlert(
    {
      send: sendEmail,
      onError: (errorName) => {
        console.error(`[alerte] email non envoyé (${errorName})`);
      },
    },
    { email, minutes: Math.max(1, Math.ceil(retryAfterSeconds / 60)) },
  );
}

export function createLoginDeps(): LoginDeps {
  const db = getDb();
  return {
    admitAttempt: admitAttemptInTransaction,
    findCredentials: (email) => findUserCredentialsByEmail(db, email),
    verifyPassword,
    verifyAgainstDummyHash,
    clearAttempts: (key) => deleteRateLimit(db, key),
    createSession: (userId) => createSession(db, userId),
    now: () => new Date(),
    onAccountBlocked: alertAccountBlocked,
  };
}