"use server";

/**
 * Server Action de la page « Compléter mon profil ». L'utilisateur vient de la session
 * (§6.2), jamais du formulaire ; après l'enregistrement, direction l'accueil.
 */
import { redirect } from "next/navigation";
import type { ProfileState } from "@/server/account/profile";
import { updateCurrentUserProfile } from "@/server/account/update-profile";

export async function completeProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const state = await updateCurrentUserProfile(formData);
  if (state.status === "saved") {
    redirect("/");
  }
  return state;
}
