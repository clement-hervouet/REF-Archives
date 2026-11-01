/**
 * Branche la logique de connexion (`login.ts`) sur la vraie base et le vrai hash.
 */
import { getDb, withTransaction } from "../db/pool";
import { deleteRateLimit, lockRateLimits, saveRateLimit } from "../db/rate-limits";
import { createSession } from "../db/sessions";
import { findUserCredentialsByEmail } from "../db/users";
import type { Queryable } from "../db/users";
import { verifyAgainstDummyHash, verifyPassword } from "./password";
import type { LoginDeps } from "./login";
import { admitAttempt } from "./rate-limit";
import type { RateLimitStore } from "./rate-limit";

function storeFor(transaction: Queryable): RateLimitStore {
  return {
    lock: (keys) => lockRateLimits(transaction, keys),
    save: (key, state) => saveRateLimit(transaction, key, state),
  };
}

export function createLoginDeps(): LoginDeps {
  const db = getDb();
  return {
    // Verrouillage et incrément dans une seule transaction : voir `rate-limit.ts`.
    admitAttempt: (keys, now) =>
      withTransaction((transaction) => admitAttempt(storeFor(transaction), keys, now)),
    findCredentials: (email) => findUserCredentialsByEmail(db, email),
    verifyPassword,
    verifyAgainstDummyHash,
    clearAttempts: (key) => deleteRateLimit(db, key),
    createSession: (userId) => createSession(db, userId),
    now: () => new Date(),
  };
}