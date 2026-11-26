import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageTitle } from "@/components/features/common/page-title";
import { fr } from "@/i18n/fr";
import { PRIVACY_PATH, sharePath } from "@/lib/app-paths";
import { tokenSchema } from "@/lib/schemas/auth";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";
import { AppBrand } from "@/components/features/common/app-brand";

export const metadata: Metadata = { title: fr.auth.login.title };

type LoginPageProps = {
  searchParams: Promise<{
    reset?: string | string[];
    deleted?: string | string[];
    /** Jeton d'un lien de partage de préparation à rouvrir après la connexion. */
    partage?: string | string[];
  }>;
};

/**
 * Un visiteur déjà connecté n'a rien à faire ici. C'est la page qui redirige (après
 * vérification en base), pas le proxy : un cookie périmé provoquerait une boucle.
 * Sous <Suspense> car la lecture de la session utilise les cookies de la requête.
 */
async function RedirectIfSignedIn({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user !== null) {
    const token = tokenSchema.safeParse((await searchParams).partage);
    redirect(token.success ? sharePath(token.data) : "/");
  }
  return null;
}

/** Jeton de partage bien formé de l'URL, à renvoyer avec le formulaire ; sinon rien. */
async function ShareLogin({ searchParams }: LoginPageProps) {
  const token = tokenSchema.safeParse((await searchParams).partage);
  if (!token.success) {
    return <LoginForm />;
  }
  return (
    <>
      <p role="status" className="rounded-md border border-input p-3 text-sm">
        {fr.sharing.loginNotice}
      </p>
      <LoginForm shareToken={token.data} />
    </>
  );
}

/**
 * Confirmation affichée après un reset réussi (`/login?reset=1`) ou après la suppression
 * programmée de son compte (`/login?deleted=1`, bloc 11).
 */
async function LoginNotice({ searchParams }: LoginPageProps) {
  const { reset, deleted } = await searchParams;
  const text =
    reset === "1"
      ? fr.auth.login.passwordResetDone
      : deleted === "1"
        ? fr.auth.login.accountDeletionScheduled
        : null;
  if (text === null) {
    return null;
  }
  return (
    <p role="status" className="rounded-md border border-input p-3 text-sm">
      {text}
    </p>
  );
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
      <AppBrand />
      <PageTitle>{fr.auth.login.title}</PageTitle>
      <Suspense fallback={null}>
        <LoginNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<LoginForm />}>
        <ShareLogin searchParams={searchParams} />
      </Suspense>
      <Link
        href={PRIVACY_PATH}
        className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline"
      >
        {fr.privacy.link}
      </Link>
    </main>
  );
}
