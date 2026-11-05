/**
 * Déclenchement quotidien des rappels (§5.2, §9), appelé par un cron de l'hôte :
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/reminders
 *
 * Route publique pour `src/proxy.ts` (pas de session) : l'authentification est le secret.
 * Sans `CRON_SECRET` configuré, la route n'existe pas (404). Le job est idempotent : un
 * appel en double ne renvoie aucun email deux fois.
 */
import { getEnv } from "@/lib/env";
import { isAuthorizedCronRequest } from "@/server/reminders/cron-auth";
import { createRunRemindersDeps } from "@/server/reminders/reminder-deps";
import { runReminders } from "@/server/reminders/run-reminders";

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
  // Une erreur de base au moment de lister les comptes remonte en 500, sans détail
  // envoyé au client ; les échecs d'envoi individuels sont comptés dans `failed`.
  const result = await runReminders(createRunRemindersDeps(), new Date());
  return Response.json(result, { headers: NO_STORE });
}
