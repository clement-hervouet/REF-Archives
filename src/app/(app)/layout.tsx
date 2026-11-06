import type { ReactNode } from "react";
import { MobileNav } from "@/components/features/navigation/mobile-nav";
import type { NavUser } from "@/components/features/navigation/nav-user";
import { Sidebar } from "@/components/features/navigation/sidebar";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { logout } from "./actions";

// La CSP à nonce (src/proxy.ts) exige un rendu à chaque requête : une page prérendue
// au build ne pourrait pas porter le nonce, et ses scripts seraient bloqués.
export const dynamic = "force-dynamic";

/**
 * Mise en page de l'application : barre latérale (ordinateur) ou onglets en bas (téléphone).
 *
 * La session est lue AVANT tout rendu (Cache Components est désactivé, §3.5) : sans session
 * ou sans nom, la redirection part en vrai 307, avant le moindre octet de page. Chaque page
 * vérifie quand même elle-même (§6.2) ; la lecture est mémoïsée (une requête en base).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUserOrRedirect();
  const navUser: NavUser = {
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    isAdmin: user.role === "admin",
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:shadow-sm"
      >
        {fr.nav.skip}
      </a>
      <Sidebar user={navUser} logoutAction={logout} />
      <MobileNav user={navUser} logoutAction={logout} />
      {/* Marge basse sur téléphone : le contenu ne passe jamais sous la barre d'onglets. */}
      <main
        id="contenu"
        tabIndex={-1}
        className="px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none md:ml-60 md:px-8 md:pt-10 md:pb-12"
      >
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
