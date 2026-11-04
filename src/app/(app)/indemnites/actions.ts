"use server";

/**
 * Server Action de la liste des indemnités : suppression (soft delete). La session est
 * vérifiée en base (§6.2) et l'indemnité doit appartenir à l'utilisateur connecté.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createCompensationDeps } from "@/server/compensation/compensation-deps";
import { handleDeleteCompensation } from "@/server/compensation/compensation-form";
import type { DeleteCompensationState } from "@/server/compensation/compensation-form";

export async function deleteCompensationAction(
  _previous: DeleteCompensationState,
  formData: FormData,
): Promise<DeleteCompensationState> {
  const user = await requireUser();
  const state = await handleDeleteCompensation(createCompensationDeps(), user.id, formData);
  revalidatePath("/indemnites", "layout");
  return state;
}
