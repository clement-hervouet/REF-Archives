/**
 * Adresse IP du client, pour le rate limiting.
 * Derrière Caddy, `X-Forwarded-For` est réécrit par le proxy (comportement par défaut
 * tant que `trusted_proxies` n'est pas configuré) : on prend donc sa première valeur.
 */
import { isIP } from "node:net";

/** Valeur utilisée quand aucune IP valide n'est disponible (tous les clients partagent alors un compteur). */
export const UNKNOWN_IP = "unknown";

function validIp(value: string | undefined): string | null {
  return value !== undefined && isIP(value) !== 0 ? value : null;
}

export function getClientIp(headers: Headers): string {
  const forwarded = validIp(headers.get("x-forwarded-for")?.split(",")[0]?.trim());
  if (forwarded !== null) {
    return forwarded;
  }
  return validIp(headers.get("x-real-ip")?.trim()) ?? UNKNOWN_IP;
}