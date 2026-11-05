/**
 * Proxy Next.js 16, exécuté avant chaque requête :
 * 1. génère le nonce de la CSP et pose les en-têtes de sécurité ;
 * 2. redirige vers /login les visiteurs sans cookie de session (confort uniquement).
 *
 * Ce fichier ne protège PAS les données : la vérification qui fait foi se fait en base,
 * dans les pages et Server Actions (`src/server/auth/session.ts`, §6.2).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildContentSecurityPolicy,
  generateNonce,
  getSecurityHeaders,
} from "@/lib/security-headers";
import { SESSION_COOKIE_NAMES, isPublicPath } from "@/server/auth/public-paths";

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV !== "production",
  });

  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  let response: NextResponse;
  if (isPublicPath(pathname) || hasSessionCookie) {
    // Next.js lit le nonce dans l'en-tête CSP de la REQUÊTE pour l'appliquer à ses scripts.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    response = NextResponse.redirect(loginUrl);
  }

  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(getSecurityHeaders(pathname))) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Tout sauf les ressources statiques de Next.js et les fichiers avec extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
