"use server";

/**
 * Server Actions du barème commun, réservées aux administrateurs. `requireAdmin` est
 * appelé AVANT de construire le propriétaire « commun » : c'est la seule porte
 * d'écriture vers ce barème (§3.7). Chaque écriture réussie est journalisée (bloc 16, F6) :
 * le barème commun s'applique à tous les comptes, ses modifications doivent laisser une trace.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireAdmin } from "@/server/auth/session";
import type { ScaleOwner } from "@/server/db/scales";
import type { SecurityEventType } from "@/server/db/security-events";
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
const COMMON_OWNER: ScaleOwner = { kind: "common" };

function revalidateScalePages(): void {
  revalidatePath(COMMON_SCALE_PATH);
  revalidatePath(SCALES_PATH);
}

/** Journalise une écriture du barème commun : l'admin en est l'auteur (`userId`). */
async function recordCommonScaleEvent(adminId: string, type: SecurityEventType): Promise<void> {
  const ip = getClientIp(await headers());
  await recordSecurityEvent({ type, userId: adminId, ip });
}

export async function addCommonScaleRateAction(
  _previous: AddRateState,
  formData: FormData,
): Promise<AddRateState> {
  const admin = await requireAdmin();
  const state = await handleAddRate(createScaleDeps(), COMMON_OWNER, formData);
  if (state.status === "added") {
    await recordCommonScaleEvent(admin.id, "common_scale_rate_added");
  }
  revalidateScalePages();
  return state;
}

export async function deleteCommonScaleRateAction(
  _previous: DeleteRateState,
  formData: FormData,
): Promise<DeleteRateState> {
  const admin = await requireAdmin();
  const state = await handleDeleteRate(createScaleDeps(), COMMON_OWNER, formData);
  if (state.status === "deleted") {
    await recordCommonScaleEvent(admin.id, "common_scale_rate_deleted");
  }
  revalidateScalePages();
  return state;
}

export async function renameCommonScaleAction(
  _previous: RenameScaleState,
  formData: FormData,
): Promise<RenameScaleState> {
  const admin = await requireAdmin();
  const state = await handleRenameScale(createScaleDeps(), COMMON_OWNER, formData);
  if (state.status === "renamed") {
    await recordCommonScaleEvent(admin.id, "common_scale_renamed");
  }
  revalidateScalePages();
  return state;
}
