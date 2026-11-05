"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { getEnv } from "@/lib/env";
import { emailSchema } from "@/lib/schemas/auth";
import { getClientIp } from "@/server/auth/client-ip";
import { requestPasswordReset } from "@/server/auth/password-reset";
import { createRequestPasswordResetDeps } from "@/server/auth/password-reset-deps";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { PASSWORD_RESET_TTL_SECONDS } from "@/server/db/password-resets";
import { sendPasswordResetEmail } from "@/server/email/password-reset-email";
import { sendEmail } from "@/server/email/mailer";

/** `email` est renvoyé dans tous les états pour que le champ ne soit pas vidé après une erreur. */
export type ForgotPasswordFormState =
  | { status: "idle"; email: string }
  | { status: "invalid_email"; email: string }
  | { status: "rate_limited"; email: string; retryAfterMinutes: number }
  // Identique que le compte existe ou non (§6.1).
  | { status: "requested"; email: string; validityMinutes: number };

/**
 * Demande un lien de réinitialisation. La réponse ne dépend jamais de l'existence du
 * compte : l'envoi de l'email (lent) se fait APRÈS la réponse, avec `after()`.
 */
export async function requestPasswordResetAction(
  _previous: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const rawEmail = formData.get("email");
  const typedEmail = typeof rawEmail === "string" ? rawEmail : "";

  const email = emailSchema.safeParse(typedEmail);
  if (!email.success) {
    return { status: "invalid_email", email: typedEmail };
  }

  const ip = getClientIp(await headers());
  const result = await requestPasswordReset(createRequestPasswordResetDeps(), {
    email: email.data,
    ip,
  });

  if (result.status === "rate_limited") {
    return {
      status: "rate_limited",
      email: typedEmail,
      retryAfterMinutes: Math.max(1, Math.ceil(result.retryAfterSeconds / 60)),
    };
  }

  if (result.status === "issued") {
    const { userId, token } = result;
    const appUrl = getEnv().APP_URL;
    after(async () => {
      await sendPasswordResetEmail(
        {
          send: sendEmail,
          appUrl,
          onError: (errorName) => {
            console.error(`[reset] email non envoyé (${errorName})`);
          },
        },
        { email: email.data, token },
      );
      await recordSecurityEvent({ type: "password_reset_requested", userId, ip });
    });
  }

  return {
    status: "requested",
    email: email.data,
    validityMinutes: PASSWORD_RESET_TTL_SECONDS / 60,
  };
}
