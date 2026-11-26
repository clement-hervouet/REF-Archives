/**
 * Branche les formulaires des axes d'amélioration (`manage-improvement-axes.ts`) sur la
 * vraie base.
 */
import { withTransaction } from "../db/pool";
import type { ImprovementAxesDeps } from "./manage-improvement-axes";

export function createImprovementAxesDeps(): ImprovementAxesDeps {
  return { transaction: withTransaction };
}
