"use server";

/**
 * Server Action de la page « Compléter mon profil ». L'utilisateur vient de la session
 * (§6.2), jamais du formulaire ; après l'enregistrement, direction l'accueil, ou le lien de
 * partage de préparation qui a amené ici.
 */
import { redirect } from "next/navigation";
import { sharePath } from "@/lib/app-paths";
import { tokenSchema } from "@/lib/schemas/auth";
import type { ProfileState } from "@/server/account/profile";
import { updateCurrentUserProfile } from "@/server/account/update-profile";

/**
 * `shareToken` : jeton d'un lien de partage, lié par la page (`bind`) ; il vient donc du
 * navigateur et est revalidé ici. Le chemin est reconstruit à partir du jeton validé.
 */
export async function completeProfileAction(
  shareToken: string | null,
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const state = await updateCurrentUserProfile(formData);
  if (state.status === "saved") {
    const token = tokenSchema.safeParse(shareToken);
    redirect(token.success ? sharePath(token.data) : "/");
  }
  return state;
}
