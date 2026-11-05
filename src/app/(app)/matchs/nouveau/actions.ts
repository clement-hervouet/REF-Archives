"use server";

/**
 * Server Action de la page « Nouveau match sans indemnité ». La session est vérifiée en
 * base (§6.2) ; le propriétaire vient de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gamePath } from "@/lib/app-paths";
import { requireUser } from "@/server/auth/session";
import { createGameDeps } from "@/server/games/game-deps";
import { handleCreateStandaloneGame } from "@/server/games/game-info-form";
import type { GameFormState } from "@/server/games/game-info-form";

export async function createStandaloneGameAction(
  _previous: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  const user = await requireUser();
  const state = await handleCreateStandaloneGame(createGameDeps(), user.id, formData);
  if (state.status === "created") {
    revalidatePath("/notes");
    revalidatePath("/collegues");
    redirect(gamePath(state.gameId));
  }
  return state;
}
