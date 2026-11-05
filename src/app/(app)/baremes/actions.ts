"use server";

/**
 * Server Actions de la page « Mes barèmes ». Chaque action vérifie la session en base
 * (§6.2), puis n'agit que sur les barèmes de l'utilisateur connecté : le propriétaire
 * vient de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import type { ScaleOwner } from "@/server/db/scales";
import {
  handleAddRate,
  handleCreateScale,
  handleDeleteRate,
  handleDeleteScale,
  handleRenameScale,
  handleSetLevelDefault,
} from "@/server/scales/manage-scales";
import type {
  AddRateState,
  CreateScaleState,
  DeleteRateState,
  DeleteScaleState,
  LevelDefaultState,
  RenameScaleState,
} from "@/server/scales/manage-scales";
import { createScaleDeps } from "@/server/scales/scale-deps";

const SCALES_PATH = "/baremes";

async function currentOwner(): Promise<{ userId: string; owner: ScaleOwner }> {
  const user = await requireUser();
  return { userId: user.id, owner: { kind: "user", userId: user.id } };
}

export async function createScaleAction(
  _previous: CreateScaleState,
  formData: FormData,
): Promise<CreateScaleState> {
  const { userId } = await currentOwner();
  const state = await handleCreateScale(createScaleDeps(), userId, formData);
  revalidatePath(SCALES_PATH);
  return state;
}

export async function addScaleRateAction(
  _previous: AddRateState,
  formData: FormData,
): Promise<AddRateState> {
  const { owner } = await currentOwner();
  const state = await handleAddRate(createScaleDeps(), owner, formData);
  revalidatePath(SCALES_PATH);
  return state;
}

export async function renameScaleAction(
  _previous: RenameScaleState,
  formData: FormData,
): Promise<RenameScaleState> {
  const { owner } = await currentOwner();
  const state = await handleRenameScale(createScaleDeps(), owner, formData);
  revalidatePath(SCALES_PATH);
  return state;
}

export async function deleteScaleRateAction(
  _previous: DeleteRateState,
  formData: FormData,
): Promise<DeleteRateState> {
  const { owner } = await currentOwner();
  const state = await handleDeleteRate(createScaleDeps(), owner, formData);
  revalidatePath(SCALES_PATH);
  return state;
}

export async function deleteScaleAction(
  _previous: DeleteScaleState,
  formData: FormData,
): Promise<DeleteScaleState> {
  const { userId } = await currentOwner();
  const state = await handleDeleteScale(createScaleDeps(), userId, formData);
  revalidatePath(SCALES_PATH);
  return state;
}

export async function setLevelDefaultAction(
  _previous: LevelDefaultState,
  formData: FormData,
): Promise<LevelDefaultState> {
  const { userId } = await currentOwner();
  const state = await handleSetLevelDefault(createScaleDeps(), userId, formData);
  revalidatePath(SCALES_PATH);
  return state;
}
