/**
 * Branche le changement de mot de passe (`change-password.ts`) sur la vraie base, le vrai
 * hash et le rate limiting partagé avec la connexion.
 */
import { admitAttemptInTransaction } from "../auth/login-deps";
import { hashPassword, verifyPassword } from "../auth/password";
import { getDb, withTransaction } from "../db/pool";
import { findUserCredentialsByEmail } from "../db/users";
import type { ChangePasswordDeps } from "./change-password";

export function createChangePasswordDeps(): ChangePasswordDeps {
  return {
    transaction: withTransaction,
    now: () => new Date(),
    admitAttempt: admitAttemptInTransaction,
    findCredentials: (email) => findUserCredentialsByEmail(getDb(), email),
    verifyPassword,
    hashPassword,
  };
}
