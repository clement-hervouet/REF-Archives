/**
 * Branche la logique des demandes d'accès (`access-requests.ts`) sur la vraie base.
 */
import { insertAccessRequest } from "../db/access-requests";
import { getDb, withTransaction } from "../db/pool";
import type { InviteFromAccessRequestDeps, SubmitAccessRequestDeps } from "./access-requests";
import { admitAttemptInTransaction } from "./login-deps";
import { generateToken } from "./tokens";

export function createSubmitAccessRequestDeps(): SubmitAccessRequestDeps {
  return {
    admitAttempt: admitAttemptInTransaction,
    insert: (request) => insertAccessRequest(getDb(), request),
    now: () => new Date(),
  };
}

export function createInviteFromAccessRequestDeps(): InviteFromAccessRequestDeps {
  return { generateToken, transaction: withTransaction };
}
