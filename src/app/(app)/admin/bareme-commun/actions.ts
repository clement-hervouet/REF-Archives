"use server";

/**
 * Server Actions du barème commun, réservées aux administrateurs. `requireAdmin` est
 * appelé AVANT de construire le propriétaire « commun » : c'est la seule porte
 * d'écriture vers ce barème (§3.7).
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import type { ScaleOwner } from "@/server/db/scales";
import { handleAddRate, handleDeleteRate, handleRenameScale } from "@/server/scales/manage-scales";
import type {
  AddRateState,
  DeleteRateState,
  RenameScaleState,
} from "@/server/scales/manage-scales";
import { createScaleDeps } from "@/server/scales/scale-deps";

const COMMON_SCALE_PATH = "/admin/bareme-commun";
// Les utilisateurs voient aussi le barème commun sur leur page.
const SCALES_PATH = "/baremes";

async function commonOwner(): Promise<ScaleOwner> {
  await requireAdmin();
  return { kind: "common" };
}

function revalidateScalePages(): void {
  revalidatePath(COMMON_SCALE_PATH);
  revalidatePath(SCALES_PATH);
}

export async function addCommonScaleRateAction(
  _previous: AddRateState,
  formData: FormData,
): Promise<AddRateState> {
  const owner = await commonOwner();
  const state = await handleAddRate(createScaleDeps(), owner, formData);
  revalidateScalePages();
  return state;
}

export async function deleteCommonScaleRateAction(
  _previous: DeleteRateState,
  formData: FormData,
): Promise<DeleteRateState> {
  const owner = await commonOwner();
  const state = await handleDeleteRate(createScaleDeps(), owner, formData);
  revalidateScalePages();
  return state;
}

export async function renameCommonScaleAction(
  _previous: RenameScaleState,
  formData: FormData,
): Promise<RenameScaleState> {
  const owner = await commonOwner();
  const state = await handleRenameScale(createScaleDeps(), owner, formData);
  revalidateScalePages();
  return state;
}
