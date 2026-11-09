/**
 * Branche la suppression de son propre compte (`delete-account.ts`) sur la vraie base,
 * le vrai hash et le rate limiting partagé avec la connexion.
 */
import { admitAttemptInTransaction } from "../auth/login-deps";
import { verifyPassword } from "../auth/password";
import { getDb, withTransaction } from "../db/pool";
import { findUserCredentialsByEmail } from "../db/users";
import type { SelfDeletionDeps } from "./delete-account";

export function createSelfDeletionDeps(): SelfDeletionDeps {
  return {
    transaction: withTransaction,
    now: () => new Date(),
    admitAttempt: admitAttemptInTransaction,
    findCredentials: (email) => findUserCredentialsByEmail(getDb(), email),
    verifyPassword,
  };
}
