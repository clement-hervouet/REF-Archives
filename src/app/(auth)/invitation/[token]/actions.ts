"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { tokenSchema } from "@/lib/schemas/auth";
import { signIn } from "@/server/auth/auth";
import { getClientIp } from "@/server/auth/client-ip";
import { createAcceptInvitationDeps } from "@/server/auth/invitation-deps";
import { acceptInvitation } from "@/server/auth/invitations";
import { recordSecurityEvent } from "@/server/auth/record-security-event";

export type AcceptFormState =
  | { status: "idle" }
  | { status: "mismatch" }
  | { status: "invalid_invitation" }
  | { status: "invalid_password"; issues: string[] }
  | { status: "rate_limited"; retryAfterMinutes: number };

/** Connecte l'invité avec le mot de passe qu'il vient de choisir. Ne revient jamais en cas de succès. */
async function signInAfterCreation(email: string, password: string): Promise<never> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error: unknown) {
    // Le compte existe déjà : en cas d'échec technique, l'invité se connecte à la main.
    if (error instanceof AuthError) {
      redirect("/login");
    }
    // Inclut la redirection de Next.js après une connexion réussie : elle doit remonter.
    throw error;
  }
  return redirect("/");
}

export async function acceptInvitationAction(
  _previous: AcceptFormState,
  formData: FormData,
): Promise<AcceptFormState> {
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (
    typeof token !== "string" ||
    typeof password !== "string" ||
    typeof confirmation !== "string"
  ) {
    return { status: "invalid_invitation" };
  }
  if (password !== confirmation) {
    return { status: "mismatch" };
  }

  const ip = getClientIp(await headers());
  const result = await acceptInvitation(createAcceptInvitationDeps(), { token, password, ip });

  switch (result.status) {
    case "invalid_invitation":
      // Seuls les jetons bien formés sont journalisés : ils ont été comptés par le rate
      // limiting, donc leur nombre est borné (un jeton mal formé ne coûte rien à envoyer).
      if (tokenSchema.safeParse(token).success) {
        await recordSecurityEvent({ type: "invitation_rejected", ip });
      }
      return { status: "invalid_invitation" };
    case "invalid_password":
      return { status: "invalid_password", issues: result.issues };
    case "rate_limited":
      return {
        status: "rate_limited",
        retryAfterMinutes: Math.max(1, Math.ceil(result.retryAfterSeconds / 60)),
      };
    case "created":
      await recordSecurityEvent({ type: "invitation_accepted", userId: result.userId, ip });
      return signInAfterCreation(result.email, password);
  }
}