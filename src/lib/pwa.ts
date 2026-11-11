/**
 * Application installable (bloc 14) : constantes et fonctions pures partagées par le
 * manifeste, le layout racine, la page « hors ligne » et la section « Installer
 * l'application » des paramètres.
 *
 * Le manifeste et la balise `theme-color` ne savent pas lire une variable CSS : les couleurs
 * de `src/app/globals.css` (§3.12) sont donc recopiées ici, une seule fois.
 */
import type { MetadataRoute } from "next";
import { fr } from "@/i18n/fr";
import type { ThemeAttribute } from "@/lib/theme";

export const PWA_COLORS = {
  /** Marine de la palette : fond des icônes, couleur de l'application dans le manifeste. */
  brand: "#08335b",
  /** `--background` du thème clair : écran de démarrage et barre d'état en clair. */
  lightBackground: "#ffffff",
  /** `--background` du thème sombre : barre d'état en sombre. */
  darkBackground: "#061a2e",
} as const;

/** Page affichée par le service worker quand une page ne peut pas être chargée. */
export const OFFLINE_PATH = "/hors-ligne";

/** Feuille de styles de la page hors ligne (fichier de `public/`, mis en cache avec elle). */
export const OFFLINE_STYLESHEET_PATH = "/offline.css";

/** Service worker (fichier de `public/`), enregistré à la racine pour couvrir tout le site. */
export const SERVICE_WORKER_PATH = "/sw.js";

export const PWA_ICONS = {
  small: "/icons/icon-192.png",
  large: "/icons/icon-512.png",
  maskable: "/icons/icon-maskable-512.png",
} as const;

/**
 * Manifeste de l'application, servi par Next.js à `/manifest.webmanifest`.
 * L'icône « maskable » garde le sifflet dans la zone sûre (cercle de 80 %) : Android peut la
 * découper en cercle, en goutte ou en carré arrondi sans rien couper.
 */
export function buildManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: fr.app.name,
    short_name: fr.app.name,
    description: fr.app.tagline,
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_COLORS.lightBackground,
    theme_color: PWA_COLORS.brand,
    icons: [
      { src: PWA_ICONS.small, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: PWA_ICONS.large, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: PWA_ICONS.maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

export type ThemeColor = { color: string; media?: string };

/**
 * Couleur de la barre d'état (téléphone) et de la barre de titre (ordinateur) : celle du fond
 * de page, pour que l'application installée paraisse d'un seul tenant. Thème choisi dans les
 * paramètres = une seule couleur ; thème du système = une couleur par `prefers-color-scheme`.
 */
export function themeColorsFor(theme: ThemeAttribute): ThemeColor[] {
  if (theme === "light") {
    return [{ color: PWA_COLORS.lightBackground }];
  }
  if (theme === "dark") {
    return [{ color: PWA_COLORS.darkBackground }];
  }
  return [
    { media: "(prefers-color-scheme: light)", color: PWA_COLORS.lightBackground },
    { media: "(prefers-color-scheme: dark)", color: PWA_COLORS.darkBackground },
  ];
}

/**
 * Situation de l'appareil pour la section « Installer l'application » :
 * - `standalone` : on est déjà dans l'application installée ;
 * - `ios` : iPhone ou iPad, où aucun navigateur ne propose de bouton d'installation
 *   (il faut passer par « Sur l'écran d'accueil ») ;
 * - `browser` : tout autre navigateur, qui propose (ou non) l'installation lui-même.
 */
export type InstallPlatform = "standalone" | "ios" | "browser";

export type InstallEnvironment = {
  /** Vrai si la page s'affiche en mode application (`display-mode: standalone`). */
  standalone: boolean;
  userAgent: string;
  /** `navigator.maxTouchPoints` : distingue un iPad (qui se présente comme un Mac) d'un Mac. */
  maxTouchPoints: number;
};

const IOS_DEVICE = /\b(iPhone|iPad|iPod)\b/;

export function detectInstallPlatform(environment: InstallEnvironment): InstallPlatform {
  if (environment.standalone) {
    return "standalone";
  }
  const isIpadAsMac = environment.userAgent.includes("Macintosh") && environment.maxTouchPoints > 1;
  return IOS_DEVICE.test(environment.userAgent) || isIpadAsMac ? "ios" : "browser";
}
