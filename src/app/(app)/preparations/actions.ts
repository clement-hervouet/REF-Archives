"use server";

/**
 * Server Actions de la préparation de match (§15.4.10) : enregistrement, suppression, et
 * « Préparer le match » depuis une indemnité (menus de « Mes indemnités », « À venir » et de
 * l'accueil).
 * La session est vérifiée en base (§6.2) ; les identifiants viennent du formulaire, chaque
 * service vérifie donc qu'ils appartiennent bien à l'utilisateur connecté.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PREPARATIONS_PATH, UPCOMING_PATH, preparationPath } from "@/lib/app-paths";
import { requireUser } from "@/server/auth/session";
import { createGameDeps } from "@/server/games/game-deps";
import {
  handleDeletePreparation,
  handlePrepareMatch,
  handleSavePreparation,
} from "@/server/games/preparation-form";
import type {
  DeletePreparationState,
  PreparationFormState,
  PrepareMatchState,
} from "@/server/games/preparation-form";

/** Pages qui affichent l'état d'une préparation. */
function revalidatePreparationPages(): void {
  revalidatePath(PREPARATIONS_PATH, "layout");
  revalidatePath("/matchs/[id]", "page");
  revalidatePath(UPCOMING_PATH);
  revalidatePath("/");
}

export async function savePreparationAction(
  _previous: PreparationFormState,
  formData: FormData,
): Promise<PreparationFormState> {
  const user = await requireUser();
  const state = await handleSavePreparation(createGameDeps(), user.id, formData);
  if (state.status === "saved") {
    revalidatePreparationPages();
  }
  return state;
}

export async function deletePreparationAction(
  _previous: DeletePreparationState,
  formData: FormData,
): Promise<DeletePreparationState> {
  const user = await requireUser();
  const state = await handleDeletePreparation(createGameDeps(), user.id, formData);
  if (state.status === "deleted") {
    revalidatePreparationPages();
  }
  return state;
}

export async function prepareMatchAction(
  _previous: PrepareMatchState,
  formData: FormData,
): Promise<PrepareMatchState> {
  const user = await requireUser();
  const result = await handlePrepareMatch(createGameDeps(), user.id, formData);
  if (result.status === "ready") {
    // Le match a pu être créé : les listes affichent désormais « Voir le match ».
    revalidatePath("/indemnites", "layout");
    revalidatePath(UPCOMING_PATH);
    revalidatePath("/");
    redirect(preparationPath(result.gameId));
  }
  return result;
}
