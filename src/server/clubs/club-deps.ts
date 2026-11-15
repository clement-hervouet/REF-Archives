/**
 * Branche les formulaires de l'onglet « Clubs » (`manage-clubs.ts`) sur la vraie base.
 */
import { withTransaction } from "../db/pool";
import type { ClubDeps } from "./manage-clubs";

export function createClubDeps(): ClubDeps {
  return { transaction: withTransaction };
}
