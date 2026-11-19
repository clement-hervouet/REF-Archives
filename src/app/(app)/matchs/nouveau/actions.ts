"use server";

/**
 * Server Actions de la page « Nouveau match sans indemnité » : depuis « Notes de match »
 * (ouvre la fiche du match) ou depuis « Préparation de match » (ouvre sa préparation,
 * §15.4.10). La session est vérifiée en base (§6.2) ; le propriétaire vient de la session,
 * jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PREPARATIONS_PATH, gamePath, preparationPath } from "@/lib/app-paths";
import { requireUser } from "@/server/auth/session";
import { findGame } from "@/server/db/games";
import { getDb } from "@/server/db/pool";
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

/** Même création, puis la préparation du match ; un plateau (sans préparation) ouvre sa fiche. */
export async function createStandaloneGameToPrepareAction(
  _previous: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  const user = await requireUser();
  const state = await handleCreateStandaloneGame(createGameDeps(), user.id, formData);
  if (state.status === "created") {
    revalidatePath("/notes");
    revalidatePath(PREPARATIONS_PATH);
    revalidatePath("/collegues");
    const game = await findGame(getDb(), { gameId: state.gameId, userId: user.id });
    redirect(
      game === null || game.team2Name === null
        ? gamePath(state.gameId)
        : preparationPath(state.gameId),
    );
  }
  return state;
}
