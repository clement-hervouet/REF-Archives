/**
 * Clés de rate limiting des envois d'emails (§6.6) : une par utilisateur, une par IP.
 * Hachées comme celles de la connexion : jamais d'identifiant ni d'IP en clair dans `rate_limit`.
 */
import { hashIdentifier } from "@/server/auth/rate-limit";

export function emailSendKeys(userId: string, ip: string): string[] {
  return [`email:user:${hashIdentifier(userId)}`, `email:ip:${hashIdentifier(ip)}`];
}
