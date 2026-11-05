/**
 * Branche les services de matchs complets (`manage-game.ts`, `manage-note.ts`) sur la
 * vraie base.
 */
import { withTransaction } from "../db/pool";
import type { GameDeps } from "./rejection";

export function createGameDeps(): GameDeps {
  return { transaction: withTransaction };
}
