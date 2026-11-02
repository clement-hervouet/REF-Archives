/**
 * En-têtes de sécurité HTTP (§6.4, A05) : fonctions pures, testables sans Next.js.
 * Elles sont appliquées par `src/proxy.ts`. HSTS est géré par Caddy, pas ici.
 */

/**
 * Nonce aléatoire de CSP : base64 d'un UUID v4 (122 bits d'aléa), un par requête.
 * `crypto` et `btoa` sont disponibles dans tous les runtimes de Next.js.
 */
export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

export type CspOptions = {
  nonce: string;
  /** En développement, Next.js a besoin de `eval` (rechargement à chaud) et de styles injectés. */
  isDevelopment: boolean;
};

/**
 * Content-Security-Policy stricte : seuls les scripts portant le nonce s'exécutent,
 * rien n'est chargé depuis un autre domaine, pas d'objets, pas de `<base>`, aucun cadre.
 */
export function buildContentSecurityPolicy({ nonce, isDevelopment }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    // 'self' est ignoré par les navigateurs récents quand 'strict-dynamic' est présent :
    // il ne reste que pour les anciens navigateurs.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // 'unsafe-inline' est ignoré dès qu'un nonce est présent : en développement (styles
    // injectés par le rechargement à chaud) on utilise donc l'un OU l'autre.
    isDevelopment ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

// Chemins dont l'URL contient un jeton secret : leur adresse ne doit jamais fuiter par le Referer.
const TOKEN_PATH_PREFIXES = ["/invitation", "/api/ical"];

function isTokenPath(pathname: string): boolean {
  return TOKEN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** En-têtes de sécurité autres que la CSP. */
export function getSecurityHeaders(pathname: string): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    // Doublon volontaire de `frame-ancestors 'none'` pour les très anciens navigateurs.
    "X-Frame-Options": "DENY",
    "Referrer-Policy": isTokenPath(pathname) ? "no-referrer" : "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}