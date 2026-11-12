/**
 * Choix du thème (bloc 10, §3.12) : « Système », « Clair » ou « Sombre ».
 * Le choix est gardé dans un cookie par appareil, lu côté serveur par le layout racine
 * qui pose `data-theme` sur `<html>` : aucun script, aucun flash au chargement.
 * Sans cookie (ou avec une valeur inconnue), le thème suit le système.
 */

/** Nom du cookie. Valeur : `light` ou `dark` ; absent = suivre le système. */
export const THEME_COOKIE = "theme";

/** Durée de vie du cookie : un an (la préférence ne contient rien de sensible). */
export const THEME_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Thème imposé à la page, ou `undefined` pour suivre le système. */
export type ThemeAttribute = "light" | "dark" | undefined;

/** Valeur de `data-theme` à partir du cookie (absent, inconnu ou `system` = `undefined`). */
export function themeAttributeFromCookie(cookieValue: string | undefined): ThemeAttribute {
  return cookieValue === "light" || cookieValue === "dark" ? cookieValue : undefined;
}

/** Préférence affichée dans le formulaire à partir du cookie. */
export function themePreferenceFromCookie(cookieValue: string | undefined): ThemePreference {
  return themeAttributeFromCookie(cookieValue) ?? "system";
}
