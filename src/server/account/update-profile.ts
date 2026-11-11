/**
 * Enregistrement du nom et du prénom de l'utilisateur connecté, partagé par les deux
 * Server Actions (« Compléter mon profil » et section « Mon compte »). L'identifiant vient
 * toujours de la session, jamais du formulaire (§6.2) ; chaque action fait ensuite sa
 * redirection ou sa revalidation.
 */
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import { updateUserProfile } from "@/server/db/users";
import { type ProfileState, handleUpdateProfile } from "./profile";

export async function updateCurrentUserProfile(formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const db = getDb();
  return handleUpdateProfile(
    { update: (userId, profile) => updateUserProfile(db, userId, profile) },
    user.id,
    formData,
  );
}
