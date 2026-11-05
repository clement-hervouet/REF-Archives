"use server";

/**
 * Server Action de la page « Modifier l'indemnité ». La session est vérifiée en base
 * (§6.2) ; l'identifiant de l'indemnité vient du formulaire, le service vérifie donc
 * qu'elle appartient bien à l'utilisateur connecté.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createCompensationDeps } from "@/server/compensation/compensation-deps";
import { handleUpdateCompensation } from "@/server/compensation/compensation-form";
import type { CompensationFormState } from "@/server/compensation/compensation-form";

export async function updateCompensationAction(
  _previous: CompensationFormState,
  formData: FormData,
): Promise<CompensationFormState> {
  const user = await requireUser();
  const state = await handleUpdateCompensation(createCompensationDeps(), user.id, formData);
  if (state.status === "updated") {
    revalidatePath("/indemnites", "layout");
    revalidatePath("/baremes");
  }
  return state;
}
