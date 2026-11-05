/**
 * Branche la logique des barèmes (`manage-scales.ts`) sur la vraie base.
 */
import { getDb, withTransaction } from "../db/pool";
import type { ScaleDeps } from "./manage-scales";

export function createScaleDeps(): ScaleDeps {
  return { db: getDb(), transaction: withTransaction };
}
