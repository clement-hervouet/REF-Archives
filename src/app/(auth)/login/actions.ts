"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { loginSchema } from "@/lib/schemas/auth";
import { AccountSuspendedError, RateLimitedError, signIn } from "@/server/auth/auth";

/** `email` est renvoyé dans tous les états pour que le champ ne soit pas vidé après une erreur. */
export type LoginFormState =
  | { status: "idle"; email: string }
  | { status: "invalid"; email: string }
  | { status: "rate_limited"; email: string; retryAfterMinutes: number }
  /** Compte bloqué par un admin (bloc 10) ; `until` en ISO, `null` = sans date de fin. */
  | { status: "blocked"; email: string; until: string | null }
  | { status: "deletion_pending"; email: string }
  | { status: "error"; email: string };

export async function login(
  _previous: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";

  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { status: "invalid", email };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (error: unknown) {
    if (error instanceof RateLimitedError) {
      return {
        status: "rate_limited",
        email,
        retryAfterMinutes: Math.max(1, Math.ceil(error.retryAfterSeconds / 60)),
      };
    }
    if (error instanceof AccountSuspendedError) {
      const { suspension } = error;
      return suspension.kind === "deletion"
        ? { status: "deletion_pending", email }
        : { status: "blocked", email, until: suspension.until?.toISOString() ?? null };
    }
    if (error instanceof CredentialsSignin) {
      return { status: "invalid", email };
    }
    if (error instanceof AuthError) {
      // Erreur technique (base indisponible…) : déjà journalisée par Auth.js.
      return { status: "error", email };
    }
    // Inclut la redirection de Next.js après une connexion réussie : elle doit remonter.
    throw error;
  }
  return { status: "idle", email };
}
