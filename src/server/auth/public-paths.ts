/**
 * Routes accessibles sans session, et noms du cookie de session Auth.js.
 * Utilisé par `src/proxy.ts` (redirection de confort, pas une protection : §6.2).
 */

// Nom du cookie Auth.js : préfixé `__Secure-` en HTTPS.
export const SESSION_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

// Les entrées /invitation, /api/ical et /api/health anticipent les prochaines étapes
// (invitations, flux iCal protégé par jeton, healthcheck Docker).
const PUBLIC_PATHS = ["/login", "/invitation", "/api/auth", "/api/ical", "/api/health"];

/** Vrai si le chemin (ou un de ses sous-chemins) est accessible sans session. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}