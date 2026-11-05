/**
 * Branche la logique du reset de mot de passe (`password-reset.ts`) sur la vraie base.
 */
import { withTransaction } from "../db/pool";
import { admitAttemptInTransaction } from "./login-deps";
import { hashPassword } from "./password";
import type { RequestPasswordResetDeps, ResetPasswordDeps } from "./password-reset";
import { generateToken } from "./tokens";

export function createRequestPasswordResetDeps(): RequestPasswordResetDeps {
  return {
    admitAttempt: admitAttemptInTransaction,
    generateToken,
    transaction: withTransaction,
    now: () => new Date(),
  };
}

export function createResetPasswordDeps(): ResetPasswordDeps {
  return {
    admitAttempt: admitAttemptInTransaction,
    hashPassword,
    transaction: withTransaction,
    now: () => new Date(),
  };
}
