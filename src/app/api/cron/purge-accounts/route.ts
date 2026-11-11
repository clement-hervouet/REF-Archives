/**
 * Purge quotidienne des comptes dont la suppression est due (bloc 10), appelée par un cron
 * de l'hôte, comme les rappels :
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/purge-accounts
 *
 * Authentification et enveloppe communes dans `handleCronRequest`.
 */
import { runPurgeAccounts } from "@/server/admin/purge-accounts";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { withTransaction } from "@/server/db/pool";
import { handleCronRequest } from "@/server/reminders/cron-auth";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleCronRequest(request, () =>
    runPurgeAccounts({
      transaction: withTransaction,
      recordDeleted: () => recordSecurityEvent({ type: "account_deleted" }),
    }),
  );
}
