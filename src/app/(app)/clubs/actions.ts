"use server";

/**
 * Server Actions de la page « Mes clubs » (§15.4.1). La session est vérifiée en base
 * (§6.2) ; le propriétaire vient toujours de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createClubDeps } from "@/server/clubs/club-deps";
import { handleCreateClub, handleDeleteClub, handleUpdateClub } from "@/server/clubs/manage-clubs";
import type { ClubFormState, DeleteClubState } from "@/server/clubs/manage-clubs";

function revalidateClubs(): void {
  revalidatePath("/clubs");
  // Nom et adresse des clubs apparaissent partout : indemnités, matchs, à venir, accueil,
  // collègues (et les listes des formulaires).
  revalidatePath("/", "layout");
}

export async function createClubAction(
  _previous: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const user = await requireUser();
  const state = await handleCreateClub(createClubDeps(), user.id, formData);
  if (state.status === "created") {
    revalidateClubs();
  }
  return state;
}

export async function updateClubAction(
  _previous: ClubFormState,
  formData: FormData,
): Promise<ClubFormState> {
  const user = await requireUser();
  const state = await handleUpdateClub(createClubDeps(), user.id, formData);
  if (state.status === "updated") {
    revalidateClubs();
  }
  return state;
}

export async function deleteClubAction(
  _previous: DeleteClubState,
  formData: FormData,
): Promise<DeleteClubState> {
  const user = await requireUser();
  const state = await handleDeleteClub(createClubDeps(), user.id, formData);
  if (state.status === "deleted") {
    revalidateClubs();
  }
  return state;
}
