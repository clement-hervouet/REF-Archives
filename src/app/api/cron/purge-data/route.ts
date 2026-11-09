/**
 * Purge quotidienne des données (bloc 11), appelée par un cron de l'hôte, comme les rappels
 * et la purge des comptes :
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/purge-data
 *
 * Route publique pour `src/proxy.ts` (préfixe `/api/cron`) : l'authentification est le
 * secret, comparé en temps constant. Sans `CRON_SECRET`, la route n'existe pas (404). La
 * réponse ne contient que des nombres de lignes effacées.
 */
import { getEnv } from "@/lib/env";
import { withTransaction } from "@/server/db/pool";
import { runPurgeData } from "@/server/maintenance/purge-data";
import { isAuthorizedCronRequest } from "@/server/reminders/cron-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const secret = getEnv().CRON_SECRET;
  if (secret === undefined) {
    return new Response(null, { status: 404, headers: NO_STORE });
  }
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 401, headers: NO_STORE });
  }
  // Une erreur de base annule toute la purge et remonte en 500, sans détail envoyé au
  // client ; le passage du lendemain recommence.
  const result = await runPurgeData({ transaction: withTransaction });
  return Response.json(result, { headers: NO_STORE });
}
