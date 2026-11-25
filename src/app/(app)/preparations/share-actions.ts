"use server";

/**
 * Server Actions de la préparation partagée (migration 035) : panneau « Partage » du
 * propriétaire, enregistrement par le destinataire, quitter un partage, se délier d'un
 * propriétaire. La session est vérifiée en base (§6.2) : le propriétaire ou le
 * destinataire est toujours le compte connecté, jamais un identifiant du formulaire.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PREPARATIONS_PATH, SHARED_PREPARATIONS_PATH, UPCOMING_PATH } from "@/lib/app-paths";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireUser } from "@/server/auth/session";
import type { PreparationFormState } from "@/server/games/preparation-form";
import { createShareLinkDeps, createSharingDeps } from "@/server/sharing/sharing-deps";
import {
  handleLeaveShare,
  handleSaveSharedPreparation,
  handleShare,
  handleUnlinkFromOwner,
} from "@/server/sharing/sharing-form";
import type { LeaveShareState, ShareState, UnlinkState } from "@/server/sharing/sharing-form";

/** Pages qui affichent une préparation, son partage ou la liste des préparations. */
function revalidatePreparationPages(): void {
  revalidatePath(PREPARATIONS_PATH, "layout");
  revalidatePath("/matchs/[id]", "page");
  revalidatePath(UPCOMING_PATH);
}

export async function shareAction(_previous: ShareState, formData: FormData): Promise<ShareState> {
  const user = await requireUser();
  const state = await handleShare(createShareLinkDeps(), user.id, formData);
  if (state.status === "link_created") {
    await recordSecurityEvent({
      type: "share_link_created",
      userId: user.id,
      ip: getClientIp(await headers()),
    });
  }
  revalidatePreparationPages();
  return state;
}

export async function saveSharedPreparationAction(
  _previous: PreparationFormState,
  formData: FormData,
): Promise<PreparationFormState> {
  const user = await requireUser();
  const state = await handleSaveSharedPreparation(createSharingDeps(), user.id, formData);
  if (state.status === "saved") {
    revalidatePreparationPages();
  }
  return state;
}

export async function leaveShareAction(
  _previous: LeaveShareState,
  formData: FormData,
): Promise<LeaveShareState> {
  const user = await requireUser();
  const state = await handleLeaveShare(createSharingDeps(), user.id, formData);
  if (state.status === "left") {
    revalidatePreparationPages();
    redirect(SHARED_PREPARATIONS_PATH);
  }
  return state;
}

export async function unlinkFromOwnerAction(
  _previous: UnlinkState,
  formData: FormData,
): Promise<UnlinkState> {
  const user = await requireUser();
  const { ownerUserId, ...state } = await handleUnlinkFromOwner(
    createSharingDeps(),
    user.id,
    formData,
  );
  if (state.status === "unlinked") {
    await recordSecurityEvent({
      type: "colleague_unlinked",
      userId: user.id,
      ...(ownerUserId !== undefined ? { targetUserId: ownerUserId } : {}),
      ip: getClientIp(await headers()),
    });
    revalidatePreparationPages();
    revalidatePath("/collegues");
  }
  return state;
}
