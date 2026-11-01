import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { fr } from "@/i18n/fr";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: fr.auth.login.title };

/**
 * Un visiteur déjà connecté n'a rien à faire ici. C'est la page qui redirige (après
 * vérification en base), pas le proxy : un cookie périmé provoquerait une boucle.
 * Sous <Suspense> car la lecture de la session utilise les cookies de la requête.
 */
async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user !== null) {
    redirect("/");
  }
  return null;
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <h1 className="text-2xl font-semibold">{fr.auth.login.title}</h1>
      <LoginForm />
    </main>
  );
}