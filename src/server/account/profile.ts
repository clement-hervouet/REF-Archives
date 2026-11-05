/**
 * Logique du formulaire « nom et prénom » (page « Compléter mon profil » et section
 * « Mon compte » des paramètres). Ni Next.js ni authentification ici : la Server Action
 * vérifie la session et fournit l'utilisateur, jamais lu dans le formulaire (§6.2).
 */
import { parseProfileForm } from "@/lib/schemas/profile";
import type { Profile, ProfileIssue } from "@/lib/schemas/profile";

export type ProfileState =
  | { status: "idle" }
  | { status: "invalid"; issues: ProfileIssue[] }
  | { status: "not_found" }
  | { status: "saved" };

export type ProfileDeps = {
  update: (userId: string, profile: Profile) => Promise<boolean>;
};

export async function handleUpdateProfile(
  deps: ProfileDeps,
  userId: string,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = parseProfileForm(formData);
  if (!parsed.success) {
    return { status: "invalid", issues: parsed.issues };
  }
  const updated = await deps.update(userId, parsed.profile);
  return updated ? { status: "saved" } : { status: "not_found" };
}
