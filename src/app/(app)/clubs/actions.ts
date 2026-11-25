"use server";

/**
 * Server Actions de la page « Mes clubs » (§15.4.1). La session est vérifiée en base
 * (§6.2) ; le propriétaire vient toujours de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createClubDeps } from "@/server/clubs/club-deps";
import {
  handleAddClubVenues,
  handleCreateClub,
  handleDeleteClub,
  handleRemoveClubVenue,
  handleSetMainClubVenue,
  handleUpdateClub,
} from "@/server/clubs/manage-clubs";
import type { ClubFormState, ClubVenueState, DeleteClubState } from "@/server/clubs/manage-clubs";

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

/** Salles ajoutées (saisie, ou import depuis l'annuaire FFBB). */
export async function addClubVenuesAction(
  _previous: ClubVenueState,
  formData: FormData,
): Promise<ClubVenueState> {
  const user = await requireUser();
  const state = await handleAddClubVenues(createClubDeps(), user.id, formData);
  if (state.status === "added") {
    revalidateClubs();
  }
  return state;
}

export async function removeClubVenueAction(
  _previous: ClubVenueState,
  formData: FormData,
): Promise<ClubVenueState> {
  const user = await requireUser();
  const state = await handleRemoveClubVenue(createClubDeps(), user.id, formData);
  if (state.status === "removed") {
    revalidateClubs();
  }
  return state;
}

export async function setMainClubVenueAction(
  _previous: ClubVenueState,
  formData: FormData,
): Promise<ClubVenueState> {
  const user = await requireUser();
  const state = await handleSetMainClubVenue(createClubDeps(), user.id, formData);
  if (state.status === "main_set") {
    revalidateClubs();
  }
  return state;
}
