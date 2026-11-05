"use server";

/**
 * Server Action de la page « Compléter mon profil ». L'utilisateur vient de la session
 * (§6.2), jamais du formulaire ; après l'enregistrement, direction l'accueil.
 */
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { type ProfileState, handleUpdateProfile } from "@/server/account/profile";
import { getDb } from "@/server/db/pool";
import { updateUserProfile } from "@/server/db/users";

export async function completeProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();
  const db = getDb();
  const state = await handleUpdateProfile(
    { update: (userId, profile) => updateUserProfile(db, userId, profile) },
    user.id,
    formData,
  );
  if (state.status === "saved") {
    redirect("/");
  }
  return state;
}
