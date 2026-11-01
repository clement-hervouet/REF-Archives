/* eslint-disable @typescript-eslint/consistent-type-definitions -- l'augmentation de module d'Auth.js exige `interface` (fusion de déclarations) ; exception du §7.1 (contrat d'une bibliothèque) */
/**
 * Extension des types Auth.js : le JWT et la session portent l'identifiant de la
 * ligne `session` (liste de révocation). Ce n'est pas un secret : sans le cookie
 * signé, il ne donne aucun accès.
 */
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    sessionId?: string;
  }

  interface Session {
    sessionId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionId?: string;
  }
}