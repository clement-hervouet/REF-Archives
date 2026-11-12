"use server";

/**
 * Server Action « Changer mon mot de passe » (page « Paramètres »). Le compte vient toujours
 * de la session vérifiée en base (§6.2), jamais du formulaire ; protection CSRF native des
 * Server Actions. Les règles sont dans `src/server/account/change-password.ts`.
 *
 * Après le changement : journal, puis alerte email (sans lien) envoyée APRÈS la réponse.
 * La session courante reste valide (les autres sont déjà révoquées en base).
 */
import { headers } from "next/headers";
import { after } from "next/server";
import { handleChangePassword } from "@/server/account/change-password";
import type { ChangePasswordResult } from "@/server/account/change-password";
import { createChangePasswordDeps } from "@/server/account/change-password-deps";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireUser } from "@/server/auth/session";
import { sendEmail } from "@/server/email/mailer";
import { sendPasswordChangedAlert } from "@/server/email/security-alert-email";

export type ChangePasswordState =
  | { status: "idle" }
  // `email` reste côté serveur : le client n'a besoin que du statut.
  | Exclude<ChangePasswordResult, { status: "changed" }>
  | { status: "changed" };

export async function changePasswordAction(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();
  const ip = getClientIp(await headers());
  const result = await handleChangePassword(
    createChangePasswordDeps(),
    { id: user.id, email: user.email, sessionId: user.sessionId },
    ip,
    formData,
  );
  if (result.status !== "changed") {
    return result;
  }
  await recordSecurityEvent({ type: "password_changed", userId: user.id, ip });
  // L'alerte part après la réponse : un échec SMTP ne doit ni retarder ni faire échouer le changement.
  after(async () => {
    await sendPasswordChangedAlert(
      {
        send: sendEmail,
        onError: (errorName) => {
          console.error(`[alerte] email non envoyé (${errorName})`);
        },
      },
      { email: result.email },
    );
  });
  return { status: "changed" };
}
