import type { Metadata } from "next";
import { Suspense } from "react";
import { fr } from "@/i18n/fr";
import { tokenSchema } from "@/lib/schemas/auth";
import { findPendingInvitation } from "@/server/db/invitations";
import { getDb } from "@/server/db/pool";
import { hashToken } from "@/server/auth/tokens";
import { AcceptForm } from "./accept-form";

// Le jeton est dans l'URL : on évite qu'il fuite par le Referer et qu'une page soit indexée.
export const metadata: Metadata = {
  title: fr.invitation.title,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type InvitationPageProps = { params: Promise<{ token: string }> };

/** Lire `params` est une donnée de requête : ce composant doit rester sous <Suspense>. */
async function InvitationContent({ params }: InvitationPageProps) {
  const { token } = await params;
  const parsed = tokenSchema.safeParse(token);
  const invitation = parsed.success
    ? await findPendingInvitation(getDb(), hashToken(parsed.data))
    : null;

  // Même message pour un lien inconnu, expiré, utilisé ou révoqué (§6.1).
  if (!parsed.success || invitation === null) {
    return <p role="alert">{fr.invitation.invalid}</p>;
  }
  return <AcceptForm token={parsed.data} email={invitation.email} />;
}

export default function InvitationPage({ params }: InvitationPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{fr.invitation.title}</h1>
      <Suspense fallback={null}>
        <InvitationContent params={params} />
      </Suspense>
    </main>
  );
}