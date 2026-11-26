"use server";

/**
 * Server Actions de la page « Axes d'amélioration ». La session est vérifiée en base (§6.2) ;
 * le propriétaire vient toujours de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { IMPROVEMENT_AXES_PATH } from "@/lib/app-paths";
import { requireUser } from "@/server/auth/session";
import { createImprovementAxesDeps } from "@/server/improvement/improvement-axes-deps";
import {
  handleCreateImprovementAxis,
  handleDeleteImprovementAxis,
  handleRenameImprovementAxis,
  handleReorderImprovementAxes,
  handleRestoreImprovementAxis,
  handleSaveImprovementAxes,
} from "@/server/improvement/manage-improvement-axes";
import type {
  CreateImprovementAxisState,
  DeleteImprovementAxisState,
  ImprovementAxesFormState,
  RenameImprovementAxisState,
  ReorderImprovementAxesState,
  RestoreImprovementAxisState,
} from "@/server/improvement/manage-improvement-axes";

export async function saveImprovementAxesAction(
  _previous: ImprovementAxesFormState,
  formData: FormData,
): Promise<ImprovementAxesFormState> {
  const user = await requireUser();
  const state = await handleSaveImprovementAxes(createImprovementAxesDeps(), user.id, formData);
  if (state.status === "saved") {
    revalidatePath(IMPROVEMENT_AXES_PATH);
  }
  return state;
}

export async function reorderImprovementAxesAction(
  _previous: ReorderImprovementAxesState,
  formData: FormData,
): Promise<ReorderImprovementAxesState> {
  const user = await requireUser();
  const state = await handleReorderImprovementAxes(createImprovementAxesDeps(), user.id, formData);
  // Périmé ou non, la page relit la liste : l'affichage repart de ce qui est enregistré.
  revalidatePath(IMPROVEMENT_AXES_PATH);
  return state;
}

export async function createImprovementAxisAction(
  _previous: CreateImprovementAxisState,
  formData: FormData,
): Promise<CreateImprovementAxisState> {
  const user = await requireUser();
  const state = await handleCreateImprovementAxis(createImprovementAxesDeps(), user.id, formData);
  if (state.status === "created") {
    revalidatePath(IMPROVEMENT_AXES_PATH);
  }
  return state;
}

export async function renameImprovementAxisAction(
  _previous: RenameImprovementAxisState,
  formData: FormData,
): Promise<RenameImprovementAxisState> {
  const user = await requireUser();
  const state = await handleRenameImprovementAxis(createImprovementAxesDeps(), user.id, formData);
  // Introuvable : la page relit la liste (catégorie supprimée dans un autre onglet).
  if (state.status === "renamed" || state.status === "notFound") {
    revalidatePath(IMPROVEMENT_AXES_PATH);
  }
  return state;
}

export async function deleteImprovementAxisAction(
  _previous: DeleteImprovementAxisState,
  formData: FormData,
): Promise<DeleteImprovementAxisState> {
  const user = await requireUser();
  const state = await handleDeleteImprovementAxis(createImprovementAxesDeps(), user.id, formData);
  revalidatePath(IMPROVEMENT_AXES_PATH);
  return state;
}

export async function restoreImprovementAxisAction(
  _previous: RestoreImprovementAxisState,
  formData: FormData,
): Promise<RestoreImprovementAxisState> {
  const user = await requireUser();
  const state = await handleRestoreImprovementAxis(createImprovementAxesDeps(), user.id, formData);
  revalidatePath(IMPROVEMENT_AXES_PATH);
  return state;
}
