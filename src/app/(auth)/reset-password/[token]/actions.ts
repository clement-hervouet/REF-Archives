"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getClientIp } from "@/server/auth/client-ip";
import { resetPassword } from "@/server/auth/password-reset";
import { createResetPasswordDeps } from "@/server/auth/password-reset-deps";
import { recordSecurityEvent } from "@/server/auth/record-security-event";

export type ResetPasswordFormState =
  | { status: "idle" }
  // Lien inconnu, expiré ou déjà utilisé : message unique (§6.1).
  | { status: "invalid_link" }
  /** Codes de `passwordSchema` (`password.too_short`…), traduits à l'affichage. */
  | { status: "invalid_password"; issues: string[] }
  | { status: "mismatch" }
  | { status: "rate_limited"; retryAfterMinutes: number };

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Change le mot de passe via le lien reçu par email, puis renvoie vers la connexion. */
export async function resetPasswordAction(
  _previous: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const password = textField(formData, "password");
  if (password !== textField(formData, "confirmation")) {
    return { status: "mismatch" };
  }

  const ip = getClientIp(await headers());
  const result = await resetPassword(createResetPasswordDeps(), {
    token: textField(formData, "token"),
    password,
    ip,
  });

  switch (result.status) {
    case "invalid_link":
      return { status: "invalid_link" };
    case "invalid_password":
      return { status: "invalid_password", issues: result.issues };
    case "rate_limited":
      return {
        status: "rate_limited",
        retryAfterMinutes: Math.max(1, Math.ceil(result.retryAfterSeconds / 60)),
      };
    case "reset":
      break;
  }

  await recordSecurityEvent({ type: "password_reset_completed", userId: result.userId, ip });
  // Toutes les sessions sont révoquées : on repart de la page de connexion.
  redirect("/login?reset=1");
}