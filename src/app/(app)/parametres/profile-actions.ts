"use server";

/**
 * Server Action de la section « Mon compte » : nom et prénom. Seul l'utilisateur connecté
 * est modifié : son id vient de la session, jamais du formulaire (§6.2).
 */
import { revalidatePath } from "next/cache";
import { SETTINGS_PATH } from "@/lib/app-paths";
import { type ProfileState, handleUpdateProfile } from "@/server/account/profile";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import { updateUserProfile } from "@/server/db/users";

export async function updateProfileAction(
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
  // Le prénom apparaît aussi dans la navigation et sur l'accueil : tout le layout est rafraîchi.
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/", "layout");
  return state;
}
