"use server";

/**
 * Server Actions de la page « Mes collègues ». La session est vérifiée en base (§6.2) ;
 * le propriétaire vient toujours de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import {
  handleCreateColleague,
  handleDeleteColleague,
  handleUpdateColleague,
} from "@/server/games/colleagues-form";
import type { ColleagueFormState, DeleteColleagueState } from "@/server/games/colleagues-form";
import { createGameDeps } from "@/server/games/game-deps";

function revalidateColleagues(): void {
  revalidatePath("/collegues");
  // Les noms apparaissent aussi sur les fiches de match.
  revalidatePath("/matchs/[id]", "page");
}

export async function createColleagueAction(
  _previous: ColleagueFormState,
  formData: FormData,
): Promise<ColleagueFormState> {
  const user = await requireUser();
  const state = await handleCreateColleague(createGameDeps(), user.id, formData);
  if (state.status === "created") {
    revalidateColleagues();
  }
  return state;
}

export async function updateColleagueAction(
  _previous: ColleagueFormState,
  formData: FormData,
): Promise<ColleagueFormState> {
  const user = await requireUser();
  const state = await handleUpdateColleague(createGameDeps(), user.id, formData);
  if (state.status === "updated") {
    revalidateColleagues();
  }
  return state;
}

export async function deleteColleagueAction(
  _previous: DeleteColleagueState,
  formData: FormData,
): Promise<DeleteColleagueState> {
  const user = await requireUser();
  const state = await handleDeleteColleague(createGameDeps(), user.id, formData);
  if (state.status === "deleted") {
    revalidateColleagues();
  }
  return state;
}
