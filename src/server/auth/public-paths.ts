/**
 * Routes accessibles sans session, et noms du cookie de session Auth.js.
 * Utilisé par `src/proxy.ts` (redirection de confort, pas une protection : §6.2).
 */

// Nom du cookie Auth.js : préfixé `__Secure-` en HTTPS.
export const SESSION_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

// /api/ical : flux iCal protégé par son jeton, vérifié dans la route (bloc 8).
// /api/health anticipe le healthcheck Docker. /api/cron est protégé par CRON_SECRET,
// vérifié dans chaque route.
const PUBLIC_PATHS = [
  "/login",
  "/invitation",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/ical",
  "/api/health",
  "/api/cron",
];

/** Vrai si le chemin (ou un de ses sous-chemins) est accessible sans session. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
