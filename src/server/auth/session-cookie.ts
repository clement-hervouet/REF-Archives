/**
 * Attributs explicites du cookie de session Auth.js (§6.1, AUTH-2).
 *
 * Auth.js v5 pose des défauts corrects (`httpOnly`, `sameSite:'lax'`, `secure` en prod,
 * préfixe `__Secure-`), mais §6.1 demande des attributs EXPLICITES : un défaut peut changer
 * au fil des versions de `next-auth@beta`. On les fige ici, dans une fonction pure testable.
 *
 * `secure` et le préfixe `__Secure-` ne sont posés qu'en production OU quand `APP_URL` est en
 * `https://` : sans quoi le navigateur refuserait le cookie en `http://localhost` (dev), ce
 * qui casserait la connexion locale. Le nom produit reste l'un des deux de
 * `SESSION_COOKIE_NAMES` (`public-paths.ts`), attendu par `proxy.ts`.
 */

export type SessionCookieConfig = {
  name: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secure: boolean;
  };
};

type SessionCookieInput = {
  nodeEnv: string | undefined;
  appUrl: string | undefined;
};

/** Construit la configuration du cookie de session à partir de l'environnement. */
export function buildSessionCookie({ nodeEnv, appUrl }: SessionCookieInput): SessionCookieConfig {
  const secure = nodeEnv === "production" || (appUrl ?? "").startsWith("https://");
  return {
    name: `${secure ? "__Secure-" : ""}authjs.session-token`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
    },
  };
}
