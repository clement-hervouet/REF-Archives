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
import { getEnv } from "@/lib/env";

const BEARER_PATTERN = /^Bearer ([^\s]+)$/;

const NO_STORE = { "Cache-Control": "no-store" };

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

/**
 * Enveloppe commune des routes `/api/cron/*`. Sans `CRON_SECRET`, la route n'existe pas
 * (404) ; en-tête `Authorization` absent ou faux, 401 ; sinon `run()` est exécuté et son
 * résultat renvoyé en JSON. Une erreur de `run()` remonte en 500, sans détail au client.
 */
export async function handleCronRequest(
  request: Request,
  run: () => Promise<unknown>,
): Promise<Response> {
  const secret = getEnv().CRON_SECRET;
  if (secret === undefined) {
    return new Response(null, { status: 404, headers: NO_STORE });
  }
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 401, headers: NO_STORE });
  }
  const result = await run();
  return Response.json(result, { headers: NO_STORE });
}
