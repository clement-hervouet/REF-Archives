"use server";

/**
 * Server Action de la page « Compléter le match ». La session est vérifiée en base
 * (§6.2) ; l'identifiant de l'indemnité vient du formulaire, le service vérifie donc
 * qu'elle appartient bien à l'utilisateur connecté.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { gamePath } from "@/lib/app-paths";
import { requireUser } from "@/server/auth/session";
import { createGameDeps } from "@/server/games/game-deps";
import { handleCreateGame } from "@/server/games/officials-form";
import type { OfficialsFormState } from "@/server/games/officials-form";

export async function createGameAction(
  _previous: OfficialsFormState,
  formData: FormData,
): Promise<OfficialsFormState> {
  const user = await requireUser();
  const state = await handleCreateGame(createGameDeps(), user.id, formData);
  if (state.status === "created") {
    revalidatePath("/indemnites", "layout");
    revalidatePath("/collegues");
    redirect(gamePath(state.gameId));
  }
  // Deux onglets : le match a été créé entre-temps, on y va directement.
  if (state.status === "already_linked") {
    redirect(gamePath(state.gameId));
  }
  return state;
}
