"use server";

/**
 * Server Action « Supprimer mon compte » (page « Paramètres », bloc 11). Le compte vient
 * toujours de la session vérifiée en base (§6.2), jamais du formulaire. Protection CSRF
 * native des Server Actions. Les règles sont dans `src/server/account/delete-account.ts`.
 *
 * Après la programmation : journal, email de confirmation (sans lien), puis suppression du
 * cookie et retour à la connexion. Les sessions sont déjà fermées en base.
 */
import { headers } from "next/headers";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { handleSelfDeletion } from "@/server/account/delete-account";
import type { SelfDeletionResult } from "@/server/account/delete-account";
import { createSelfDeletionDeps } from "@/server/account/delete-account-deps";
import { signOut } from "@/server/auth/auth";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireUser } from "@/server/auth/session";
import { sendEmail } from "@/server/email/mailer";
import { sendAccountDeletionScheduledAlert } from "@/server/email/security-alert-email";

/** Page de connexion après une suppression programmée (message de confirmation). */
const AFTER_DELETION_PATH = "/login?deleted=1";

export type AccountDeletionState =
  { status: "idle" } | Exclude<SelfDeletionResult, { status: "scheduled" }>;

export async function requestAccountDeletionAction(
  _previous: AccountDeletionState,
  formData: FormData,
): Promise<AccountDeletionState> {
  const user = await requireUser();
  const ip = getClientIp(await headers());
  const result = await handleSelfDeletion(
    createSelfDeletionDeps(),
    { id: user.id, email: user.email },
    ip,
    formData,
  );
  if (result.status !== "scheduled") {
    return result;
  }
  await recordSecurityEvent({
    type: "account_deletion_scheduled",
    userId: user.id,
    targetUserId: user.id,
    ip,
  });
  await sendAccountDeletionScheduledAlert(
    {
      send: sendEmail,
      onError: (errorName) => {
        console.error(`[compte] confirmation de suppression non envoyée (${errorName})`);
      },
    },
    { email: result.email, date: formatIsoDate(toParisIsoDate(result.dueAt)) },
  );
  // `signOut` redirige (il lève l'exception de redirection de Next.js) : rien après.
  await signOut({ redirectTo: AFTER_DELETION_PATH });
  return { status: "idle" };
}
