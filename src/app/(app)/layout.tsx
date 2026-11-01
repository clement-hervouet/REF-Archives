import type { ReactNode } from "react";
import { Suspense } from "react";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { logout } from "./actions";
import { AdminNav } from "./admin-nav";

/**
 * Bloque l'affichage de la page tant que la session n'est pas vérifiée en base.
 * Doit rester sous <Suspense> : lire la session utilise les cookies de la requête.
 */
async function AuthGate({ children }: { children: ReactNode }) {
  await requireUserOrRedirect();
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-semibold">{fr.app.name}</span>
        <nav className="flex items-center gap-2">
          <Suspense fallback={null}>
            <AdminNav />
          </Suspense>
          <form action={logout}>
            <button type="submit" className="min-h-11 rounded-md border border-neutral-400 px-4">
              {fr.auth.logout}
            </button>
          </form>
        </nav>
      </header>
      <main className="flex-1">
        <Suspense fallback={null}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
    </div>
  );
}