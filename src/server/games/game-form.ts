/**
 * Suppression d'un match complet (bloc 9). Ni Next.js ni authentification ici (§6.2) :
 * l'identifiant vient du formulaire et la requête filtre sur le propriétaire.
 */
import { z } from "zod";
import { softDeleteGame } from "../db/games";
import type { GameDeps } from "./rejection";

export type DeleteGameState = { status: "idle" } | { status: "deleted" } | { status: "not_found" };

/** Supprime (soft delete) le match désigné par le champ caché `gameId`. */
export async function handleDeleteGame(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteGameState> {
  const raw = formData.get("gameId");
  const gameId = z.uuid().safeParse(typeof raw === "string" ? raw : undefined);
  if (!gameId.success) {
    return { status: "not_found" };
  }
  const deleted = await deps.transaction((db) =>
    softDeleteGame(db, { gameId: gameId.data, userId }),
  );
  return deleted ? { status: "deleted" } : { status: "not_found" };
}
