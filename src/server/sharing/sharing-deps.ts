/**
 * Branche les services de la préparation partagée sur la vraie base.
 */
import { getEnv } from "@/lib/env";
import { admitAttemptInTransaction } from "../auth/login-deps";
import { generateToken } from "../auth/tokens";
import { withTransaction } from "../db/pool";
import type { AcceptShareDeps } from "./accept-share-link";
import type { ShareLinkDeps, SharingDeps } from "./manage-sharing";

export function createSharingDeps(): SharingDeps {
  return { transaction: withTransaction };
}

export function createShareLinkDeps(): ShareLinkDeps {
  return {
    transaction: withTransaction,
    generateToken,
    now: () => new Date(),
    appUrl: getEnv().APP_URL,
  };
}

export function createAcceptShareDeps(): AcceptShareDeps {
  return {
    transaction: withTransaction,
    admitAttempt: admitAttemptInTransaction,
    now: () => new Date(),
  };
}
