/**
 * Redirection légère des visiteurs sans cookie de session vers /login (confort uniquement).
 * Ce fichier ne protège PAS les données : la vérification qui fait foi se fait en base,
 * dans les pages et Server Actions (`src/server/auth/session.ts`, §6.2).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Nom du cookie Auth.js : préfixé `__Secure-` en HTTPS.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// Routes accessibles sans session. Les entrées /invitation, /api/ical et /api/health
// anticipent les prochaines étapes (invitations, flux iCal protégé par jeton, healthcheck).
const PUBLIC_PATHS = ["/login", "/invitation", "/api/auth", "/api/ical", "/api/health"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (isPublic(pathname) || hasSessionCookie) {
    return NextResponse.next();
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Tout sauf les ressources statiques de Next.js et les fichiers avec extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};