"use server";

/**
 * Server Action de la page « Axes d'amélioration ». La session est vérifiée en base (§6.2) ;
 * le propriétaire vient toujours de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { IMPROVEMENT_AXES_PATH } from "@/lib/app-paths";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import { handleSaveImprovementAxes } from "@/server/improvement/improvement-axes-form";
import type { ImprovementAxesFormState } from "@/server/improvement/improvement-axes-form";

export async function saveImprovementAxesAction(
  _previous: ImprovementAxesFormState,
  formData: FormData,
): Promise<ImprovementAxesFormState> {
  const user = await requireUser();
  const state = await handleSaveImprovementAxes(getDb(), user.id, formData);
  if (state.status === "saved") {
    revalidatePath(IMPROVEMENT_AXES_PATH);
  }
  return state;
}
