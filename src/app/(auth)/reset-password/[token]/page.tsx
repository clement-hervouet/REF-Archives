import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fr } from "@/i18n/fr";
import { tokenSchema } from "@/lib/schemas/auth";
import { hashToken } from "@/server/auth/tokens";
import { findPendingPasswordReset } from "@/server/db/password-resets";
import { getDb } from "@/server/db/pool";
import { ResetForm } from "./reset-form";

// Le jeton est dans l'URL : on évite qu'il fuite par le Referer et qu'une page soit indexée.
export const metadata: Metadata = {
  title: fr.resetPassword.title,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type ResetPasswordPageProps = { params: Promise<{ token: string }> };

/** Lire `params` est une donnée de requête : ce composant doit rester sous <Suspense>. */
async function ResetContent({ params }: ResetPasswordPageProps) {
  const { token } = await params;
  const parsed = tokenSchema.safeParse(token);
  const reset = parsed.success
    ? await findPendingPasswordReset(getDb(), hashToken(parsed.data))
    : null;

  // Même message pour un lien inconnu, expiré ou déjà utilisé (§6.1).
  if (!parsed.success || reset === null) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert">{fr.resetPassword.invalid}</p>
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center self-start text-sm underline"
        >
          {fr.resetPassword.requestNew}
        </Link>
      </div>
    );
  }
  return <ResetForm token={parsed.data} />;
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{fr.resetPassword.title}</h1>
      <Suspense fallback={null}>
        <ResetContent params={params} />
      </Suspense>
    </main>
  );
}
