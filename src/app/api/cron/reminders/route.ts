/**
 * Déclenchement quotidien des rappels (§5.2, §9), appelé par un cron de l'hôte :
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/reminders
 *
 * Authentification et enveloppe communes dans `handleCronRequest` (secret, 404 sans secret,
 * 401 sinon). Le job est idempotent : un appel en double ne renvoie aucun email deux fois ;
 * les échecs d'envoi individuels sont comptés dans `failed`.
 */
import { handleCronRequest } from "@/server/reminders/cron-auth";
import { createRunRemindersDeps } from "@/server/reminders/reminder-deps";
import { runReminders } from "@/server/reminders/run-reminders";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleCronRequest(request, () => runReminders(createRunRemindersDeps(), new Date()));
}
