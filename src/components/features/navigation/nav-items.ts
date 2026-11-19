/**
 * Entrées de la navigation (bloc 10, §3.12), partagées par la barre latérale (ordinateur)
 * et la barre d'onglets (téléphone). Pur et sans React : testé à part.
 */
import { fr } from "@/i18n/fr";
import {
  ACCOUNTS_PATH,
  CLUBS_PATH,
  COLLEAGUES_PATH,
  GAME_NOTES_PATH,
  INVITATIONS_PATH,
  PREPARATIONS_PATH,
  SETTINGS_PATH,
  UPCOMING_PATH,
} from "@/lib/app-paths";

export type NavIcon = "home" | "upcoming" | "compensations" | "preparations" | "notes";

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

const PREPARATIONS_NAV: NavItem = {
  href: PREPARATIONS_PATH,
  label: fr.nav.preparations,
  shortLabel: fr.nav.short.preparations,
  icon: "preparations",
};

const GAME_NOTES_NAV: NavItem = {
  href: GAME_NOTES_PATH,
  label: fr.nav.gameNotes,
  shortLabel: fr.nav.short.gameNotes,
  icon: "notes",
  // Les fiches de match s'ouvrent depuis les notes (et depuis les indemnités).
  alsoActiveOn: ["/matchs"],
};

/** Onglets du téléphone : « Préparation de match » y remplace « Notes de match » (§15.4.10). */
export const MOBILE_TAB_NAV: readonly NavItem[] = [
  { href: "/", label: fr.nav.home, icon: "home" },
  { href: UPCOMING_PATH, label: fr.nav.upcoming, icon: "upcoming" },
  {
    href: "/indemnites",
    label: fr.nav.compensations,
    shortLabel: fr.nav.short.compensations,
    icon: "compensations",
  },
  PREPARATIONS_NAV,
];

/** Pages principales de la barre latérale : les onglets du téléphone, puis « Notes de match ». */
export const PRIMARY_NAV: readonly NavItem[] = [...MOBILE_TAB_NAV, GAME_NOTES_NAV];

/** Pages secondaires : bas de la barre latérale, menu « Plus » du téléphone. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/baremes", label: fr.nav.scales },
  { href: COLLEAGUES_PATH, label: fr.nav.colleagues },
  { href: CLUBS_PATH, label: fr.nav.clubs },
];

/** Haut du menu « Plus » du téléphone : « Notes de match », puis les pages secondaires. */
export const MOBILE_PANEL_NAV: readonly NavItem[] = [GAME_NOTES_NAV, ...SECONDARY_NAV];

/** Pages d'administration : affichées aux admins seulement (l'accès reste contrôlé par chaque page). */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin/bareme-commun", label: fr.nav.commonScale },
  { href: INVITATIONS_PATH, label: fr.nav.invitations },
  { href: ACCOUNTS_PATH, label: fr.nav.accounts },
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

/**
 * Nombre à afficher en pastille à côté d'une entrée : les demandes d'accès en attente sur
 * « Invitations » (§15.4.4), 0 ailleurs (pas de pastille).
 */
export function navItemBadgeCount(item: NavItem, pendingAccessRequests: number): number {
  return item.href === INVITATIONS_PATH ? Math.max(0, pendingAccessRequests) : 0;
}

/** Texte de la pastille pour les lecteurs d'écran. */
export function pendingRequestsLabel(count: number): string {
  return count === 1
    ? fr.nav.pendingRequestsOne
    : fr.nav.pendingRequestsMany.replace("{count}", String(count));
}

/** Vrai si une des entrées est active (le bouton « Plus » s'affiche alors comme actif). */
export function isAnyNavItemActive(items: readonly NavItem[], pathname: string): boolean {
  return items.some((item) => isNavItemActive(item, pathname));
}
