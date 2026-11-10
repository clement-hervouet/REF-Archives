import type { ReactNode } from "react";
import { MobileNav } from "@/components/features/navigation/mobile-nav";
import type { NavUser } from "@/components/features/navigation/nav-user";
import { Sidebar } from "@/components/features/navigation/sidebar";
import { SeasonalBanner } from "@/components/features/seasonal/seasonal-banner";
import { SeasonalGarland } from "@/components/features/seasonal/seasonal-garland";
import { SeasonalLayer } from "@/components/features/seasonal/seasonal-layer";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import { getSeasonalState } from "@/server/account/seasonal-theme";
import { requireUserOrRedirect } from "@/server/auth/session";
import { logout } from "./actions";
import { updateSeasonalThemeAction } from "./parametres/seasonal-theme-actions";

// La CSP à nonce (src/proxy.ts) exige un rendu à chaque requête : une page prérendue
// au build ne pourrait pas porter le nonce, et ses scripts seraient bloqués.
export const dynamic = "force-dynamic";

/**
 * Mise en page de l'application : barre latérale (ordinateur) ou onglets en bas (téléphone).
 *
 * La session est lue AVANT tout rendu (Cache Components est désactivé, §3.5) : sans session
 * ou sans nom, la redirection part en vrai 307, avant le moindre octet de page. Chaque page
 * vérifie quand même elle-même (§6.2) ; la lecture est mémoïsée (une requête en base).
 *
 * Thème saisonnier (bloc 12, §3.14) : s'il est actif sur cet appareil, un calque animé et,
 * en décembre, une guirlande passent derrière le contenu ; `data-seasonal` rend alors les
 * cartes et les champs opaques (`globals.css`). À la première apparition d'une saison sur cet
 * appareil, un bandeau propose de garder ou de désactiver le thème (placé après le contenu :
 * il vient en dernier dans l'ordre de tabulation et ne prend jamais le focus).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUserOrRedirect();
  const navUser: NavUser = {
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    isAdmin: user.role === "admin",
  };
  const seasonal = await getSeasonalState();

  return (
    <div
      className="min-h-dvh"
      data-seasonal={seasonal.enabled ? seasonal.period.season : undefined}
    >
      {seasonal.enabled && (
        <>
          <SeasonalLayer season={seasonal.period.season} density={seasonal.density} />
          {seasonal.period.december && <SeasonalGarland />}
        </>
      )}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:shadow-sm"
      >
        {fr.nav.skip}
      </a>
      <Sidebar user={navUser} logoutAction={logout} />
      <MobileNav user={navUser} logoutAction={logout} />
      {/* Marge basse sur téléphone : le contenu ne passe jamais sous la barre d'onglets, ni
          sous le bandeau saisonnier quand il est affiché (le bas de page doit pouvoir remonter
          au-dessus, sinon le bouton d'un formulaire y reste caché, bloc 13). */}
      <main
        id="contenu"
        tabIndex={-1}
        className={cn(
          "px-4 pt-6 outline-none md:ml-60 md:px-8 md:pt-10 md:pb-12",
          seasonal.announce
            ? "pb-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem+var(--seasonal-banner-height)+1.5rem)]"
            : "pb-[calc(5rem+env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
      {seasonal.announce && (
        <SeasonalBanner period={seasonal.period} action={updateSeasonalThemeAction} />
      )}
    </div>
  );
}
