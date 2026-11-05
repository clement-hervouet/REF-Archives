"use server";

/**
 * Server Action de la page « Modifier le match ». La session est vérifiée en base (§6.2) ;
 * l'identifiant du match vient du formulaire, le service vérifie donc qu'il appartient à
 * l'utilisateur. L'indemnité liée est mise à jour dans la même transaction.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createGameDeps } from "@/server/games/game-deps";
import { handleUpdateGameInfo } from "@/server/games/game-info-form";
import type { GameFormState } from "@/server/games/game-info-form";

export async function updateGameInfoAction(
  _previous: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  const user = await requireUser();
  const state = await handleUpdateGameInfo(createGameDeps(), user.id, formData);
  if (state.status === "updated") {
    revalidatePath("/matchs/[id]", "page");
    revalidatePath("/matchs/[id]/modifier", "page");
    revalidatePath("/indemnites", "layout");
    revalidatePath("/a-venir");
    revalidatePath("/notes");
  }
  return state;
}
