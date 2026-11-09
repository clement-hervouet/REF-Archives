/**
 * Entrées de la navigation (bloc 10, §3.12), partagées par la barre latérale (ordinateur)
 * et la barre d'onglets (téléphone). Pur et sans React : testé à part.
 */
import { fr } from "@/i18n/fr";
import { COLLEAGUES_PATH, GAME_NOTES_PATH, SETTINGS_PATH, UPCOMING_PATH } from "@/lib/app-paths";

export type NavIcon = "home" | "upcoming" | "compensations" | "notes";

export type NavItem = {
  href: string;
  label: string;
  /** Libellé court de la barre d'onglets, où la place manque. */
  shortLabel?: string;
  /** Icône, seulement pour les onglets du téléphone (icônes avec parcimonie, §3.12). */
  icon?: NavIcon;
  /** Autres débuts de chemin qui rendent l'entrée active (ex. la fiche d'un match). */
  alsoActiveOn?: readonly string[];
};

/** Pages principales : onglets du téléphone et haut de la barre latérale. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/", label: fr.nav.home, icon: "home" },
  { href: UPCOMING_PATH, label: fr.nav.upcoming, icon: "upcoming" },
  {
    href: "/indemnites",
    label: fr.nav.compensations,
    shortLabel: fr.nav.short.compensations,
    icon: "compensations",
  },
  {
    href: GAME_NOTES_PATH,
    label: fr.nav.gameNotes,
    shortLabel: fr.nav.short.gameNotes,
    icon: "notes",
    // Les fiches de match s'ouvrent depuis les notes (et depuis les indemnités).
    alsoActiveOn: ["/matchs"],
  },
];

/** Pages secondaires : bas de la barre latérale, menu « Plus » du téléphone. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/baremes", label: fr.nav.scales },
  { href: COLLEAGUES_PATH, label: fr.nav.colleagues },
];

/** Pages d'administration : affichées aux admins seulement (l'accès reste contrôlé par chaque page). */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin/bareme-commun", label: fr.nav.commonScale },
  { href: "/admin/invitations", label: fr.nav.invitations },
];

/** Page du compte, en bas de la barre latérale. */
export const ACCOUNT_NAV: NavItem = { href: SETTINGS_PATH, label: fr.nav.settings };

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Vrai si l'entrée correspond à la page affichée. L'accueil ne l'est que sur « / » exactement. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") {
    return pathname === "/";
  }
  return [item.href, ...(item.alsoActiveOn ?? [])].some((prefix) =>
    matchesPrefix(pathname, prefix),
  );
}

/** Vrai si une des entrées est active (le bouton « Plus » s'affiche alors comme actif). */
export function isAnyNavItemActive(items: readonly NavItem[], pathname: string): boolean {
  return items.some((item) => isNavItemActive(item, pathname));
}
