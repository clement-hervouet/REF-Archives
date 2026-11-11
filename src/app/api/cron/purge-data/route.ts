/**
 * Purge quotidienne des données (bloc 11), appelée par un cron de l'hôte, comme les rappels
 * et la purge des comptes :
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/purge-data
 *
 * Authentification et enveloppe communes dans `handleCronRequest`. La réponse ne contient
 * que des nombres de lignes effacées ; une erreur de base annule toute la purge (500), et le
 * passage du lendemain recommence.
 */
import { withTransaction } from "@/server/db/pool";
import { runPurgeData } from "@/server/maintenance/purge-data";
import { handleCronRequest } from "@/server/reminders/cron-auth";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleCronRequest(request, () => runPurgeData({ transaction: withTransaction }));
}
