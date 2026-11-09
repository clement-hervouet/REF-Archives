/**
 * Purge quotidienne des comptes dont la suppression est due (bloc 10), appelée par un cron
 * de l'hôte, comme les rappels :
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/purge-accounts
 *
 * Route publique pour `src/proxy.ts` (préfixe `/api/cron`) : l'authentification est le
 * secret, comparé en temps constant. Sans `CRON_SECRET`, la route n'existe pas (404).
 */
import { getEnv } from "@/lib/env";
import { runPurgeAccounts } from "@/server/admin/purge-accounts";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { withTransaction } from "@/server/db/pool";
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
  const result = await runPurgeAccounts({
    transaction: withTransaction,
    recordDeleted: () => recordSecurityEvent({ type: "account_deleted" }),
  });
  return Response.json(result, { headers: NO_STORE });
}
