/**
 * Branche la création d'indemnité (`create-compensation.ts`) sur la vraie base.
 */
import { withTransaction } from "../db/pool";
import type { CompensationDeps } from "./create-compensation";

export function createCompensationDeps(): CompensationDeps {
  return { transaction: withTransaction };
}
