"use server";

/**
 * Server Actions de la page « Mes collègues ». La session est vérifiée en base (§6.2) ;
 * le propriétaire vient toujours de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireUser } from "@/server/auth/session";
import {
  handleCreateColleague,
  handleDeleteColleague,
  handleUpdateColleague,
} from "@/server/games/colleagues-form";
import type { ColleagueFormState, DeleteColleagueState } from "@/server/games/colleagues-form";
import { createGameDeps } from "@/server/games/game-deps";
import { createSharingDeps } from "@/server/sharing/sharing-deps";
import { handleUnlinkColleague } from "@/server/sharing/sharing-form";
import type { UnlinkState } from "@/server/sharing/sharing-form";

function revalidateColleagues(): void {
  revalidatePath("/collegues");
  // Les noms apparaissent aussi sur les fiches de match.
  revalidatePath("/matchs/[id]", "page");
  // Un club créé ici est proposé aussi dans les formulaires d'indemnité et de match.
  revalidatePath("/indemnites", "layout");
  revalidatePath("/matchs", "layout");
}

export async function createColleagueAction(
  _previous: ColleagueFormState,
  formData: FormData,
): Promise<ColleagueFormState> {
  const user = await requireUser();
  const state = await handleCreateColleague(createGameDeps(), user.id, formData);
  if (state.status === "created") {
    revalidateColleagues();
  }
  return state;
}

export async function updateColleagueAction(
  _previous: ColleagueFormState,
  formData: FormData,
): Promise<ColleagueFormState> {
  const user = await requireUser();
  const state = await handleUpdateColleague(createGameDeps(), user.id, formData);
  if (state.status === "updated") {
    revalidateColleagues();
  }
  return state;
}

export async function deleteColleagueAction(
  _previous: DeleteColleagueState,
  formData: FormData,
): Promise<DeleteColleagueState> {
  const user = await requireUser();
  const state = await handleDeleteColleague(createGameDeps(), user.id, formData);
  if (state.status === "deleted") {
    revalidateColleagues();
  }
  return state;
}

/** Délie un collègue de son compte : ses préparations partagées ne lui sont plus accessibles. */
export async function unlinkColleagueAction(
  _previous: UnlinkState,
  formData: FormData,
): Promise<UnlinkState> {
  const user = await requireUser();
  const { linkedUserId, ...state } = await handleUnlinkColleague(
    createSharingDeps(),
    user.id,
    formData,
  );
  if (state.status === "unlinked") {
    await recordSecurityEvent({
      type: "colleague_unlinked",
      userId: user.id,
      ...(linkedUserId !== undefined ? { targetUserId: linkedUserId } : {}),
      ip: getClientIp(await headers()),
    });
    revalidateColleagues();
    revalidatePath("/preparations", "layout");
  }
  return state;
}
