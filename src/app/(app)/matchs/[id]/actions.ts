"use server";

/**
 * Server Actions de la fiche d'un match : officiels, note, suppressions. La session est
 * vérifiée en base (§6.2) ; l'identifiant du match vient du formulaire, chaque service
 * vérifie donc qu'il appartient bien à l'utilisateur connecté.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { handleDeleteGame } from "@/server/games/game-form";
import type { DeleteGameState } from "@/server/games/game-form";
import { createGameDeps } from "@/server/games/game-deps";
import { handleDeleteNote, handleSaveNote } from "@/server/games/note-form";
import type { DeleteNoteState, NoteFormState } from "@/server/games/note-form";
import { handleUpdateOfficials } from "@/server/games/officials-form";
import type { OfficialsFormState } from "@/server/games/officials-form";

const GAME_PAGE = "/matchs/[id]";

export async function updateOfficialsAction(
  _previous: OfficialsFormState,
  formData: FormData,
): Promise<OfficialsFormState> {
  const user = await requireUser();
  const state = await handleUpdateOfficials(createGameDeps(), user.id, formData);
  if (state.status === "updated") {
    revalidatePath(GAME_PAGE, "page");
    revalidatePath("/collegues");
  }
  return state;
}

export async function saveNoteAction(
  _previous: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const user = await requireUser();
  const state = await handleSaveNote(createGameDeps(), user.id, formData);
  if (state.status === "saved") {
    revalidatePath(GAME_PAGE, "page");
  }
  return state;
}

export async function deleteNoteAction(
  _previous: DeleteNoteState,
  formData: FormData,
): Promise<DeleteNoteState> {
  const user = await requireUser();
  const state = await handleDeleteNote(createGameDeps(), user.id, formData);
  if (state.status === "deleted") {
    revalidatePath(GAME_PAGE, "page");
  }
  return state;
}

export async function deleteGameAction(
  _previous: DeleteGameState,
  formData: FormData,
): Promise<DeleteGameState> {
  const user = await requireUser();
  const state = await handleDeleteGame(createGameDeps(), user.id, formData);
  if (state.status === "deleted") {
    revalidatePath("/indemnites", "layout");
    redirect("/indemnites");
  }
  return state;
}
