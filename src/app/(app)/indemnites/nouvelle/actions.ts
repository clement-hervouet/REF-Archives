"use server";

/**
 * Server Action de la page « Nouvelle indemnité ». Elle vérifie la session en base
 * (§6.2) ; l'utilisateur vient de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createCompensationDeps } from "@/server/compensation/compensation-deps";
import { handleCreateCompensation } from "@/server/compensation/compensation-form";
import type { CreateCompensationState } from "@/server/compensation/compensation-form";

export async function createCompensationAction(
  _previous: CreateCompensationState,
  formData: FormData,
): Promise<CreateCompensationState> {
  const user = await requireUser();
  const state = await handleCreateCompensation(createCompensationDeps(), user.id, formData);
  if (state.status === "created") {
    // Nouveaux clubs et adresses dans les listes ; lignes de barème désormais « utilisées ».
    revalidatePath("/indemnites/nouvelle");
    revalidatePath("/baremes");
  }
  return state;
}
