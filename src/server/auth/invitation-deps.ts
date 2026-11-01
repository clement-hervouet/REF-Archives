/**
 * Branche la logique des invitations (`invitations.ts`) sur la vraie base.
 */
import { withTransaction } from "../db/pool";
import type { AcceptInvitationDeps, CreateInvitationDeps } from "./invitations";
import { admitAttemptInTransaction } from "./login-deps";
import { hashPassword } from "./password";
import { generateToken } from "./tokens";

export function createInvitationDeps(): CreateInvitationDeps {
  return { generateToken, transaction: withTransaction };
}

export function createAcceptInvitationDeps(): AcceptInvitationDeps {
  return {
    admitAttempt: admitAttemptInTransaction,
    hashPassword,
    transaction: withTransaction,
    now: () => new Date(),
  };
}