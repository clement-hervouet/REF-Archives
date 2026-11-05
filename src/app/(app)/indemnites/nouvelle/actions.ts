"use server";

/**
 * Server Action de la page « Nouvelle indemnité ». Elle vérifie la session en base
 * (§6.2) ; l'utilisateur vient de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createCompensationDeps } from "@/server/compensation/compensation-deps";
import { handleCreateCompensation } from "@/server/compensation/compensation-form";
import type { CompensationFormState } from "@/server/compensation/compensation-form";

export async function createCompensationAction(
  _previous: CompensationFormState,
  formData: FormData,
): Promise<CompensationFormState> {
  const user = await requireUser();
  const state = await handleCreateCompensation(createCompensationDeps(), user.id, formData);
  if (state.status === "created") {
    // Nouveaux clubs et adresses dans les listes, liste et totaux à jour, lignes de
    // barème désormais « utilisées ».
    revalidatePath("/indemnites", "layout");
    revalidatePath("/baremes");
  }
  return state;
}
