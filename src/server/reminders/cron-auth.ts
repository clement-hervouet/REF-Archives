/**
 * Authentification du cron qui appelle `/api/cron/reminders` : en-tête
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Pas de cookie, donc pas de CSRF possible (un navigateur n'envoie pas cet en-tête de
 * lui-même). La comparaison se fait en temps constant sur les empreintes SHA-256 : même
 * longueur quelle que soit la saisie, et aucune information sur le secret par le temps
 * de réponse.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const BEARER_PATTERN = /^Bearer ([^\s]+)$/;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Vrai si l'en-tête `Authorization` porte exactement le secret attendu. */
export function isAuthorizedCronRequest(authorization: string | null, secret: string): boolean {
  if (authorization === null) {
    return false;
  }
  const token = BEARER_PATTERN.exec(authorization)?.[1];
  if (token === undefined) {
    return false;
  }
  return timingSafeEqual(digest(token), digest(secret));
}
