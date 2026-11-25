"use server";

/**
 * Acceptation d'un lien de partage de préparation (migration 035). La session est
 * vérifiée en base (§6.2) : le compte lié est toujours celui de la session.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { COLLEAGUES_PATH, PREPARATIONS_PATH, sharedPreparationPath } from "@/lib/app-paths";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireUser } from "@/server/auth/session";
import { createAcceptShareDeps } from "@/server/sharing/sharing-deps";
import { handleAcceptShare } from "@/server/sharing/sharing-form";

export type AcceptShareFormState =
  | { status: "idle" }
  | { status: "invalid" | "own_link" | "taken" }
  | { status: "rate_limited"; retryAfterMinutes: number };

export async function acceptShareAction(
  _previous: AcceptShareFormState,
  formData: FormData,
): Promise<AcceptShareFormState> {
  const user = await requireUser();
  const result = await handleAcceptShare(createAcceptShareDeps(), user.id, formData);
  switch (result.status) {
    case "accepted":
      if (result.newlyLinked) {
        await recordSecurityEvent({
          type: "colleague_linked",
          userId: user.id,
          targetUserId: result.ownerUserId,
          ip: getClientIp(await headers()),
        });
      }
      revalidatePath(PREPARATIONS_PATH, "layout");
      revalidatePath(COLLEAGUES_PATH);
      return redirect(sharedPreparationPath(result.gameId));
    case "rate_limited":
      return {
        status: "rate_limited",
        retryAfterMinutes: Math.max(1, Math.ceil(result.retryAfterSeconds / 60)),
      };
    default:
      return { status: result.status };
  }
}
