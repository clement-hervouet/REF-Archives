/**
 * Branche le job des rappels (`run-reminders.ts`) sur la vraie base et le vrai SMTP.
 */
import { getEnv } from "@/lib/env";
import { getDb } from "@/server/db/pool";
import {
  claimReminderDispatch,
  listReminderRecipients,
  releaseReminderDispatch,
} from "@/server/db/reminders";
import { listUpcomingMatches } from "@/server/db/upcoming-matches";
import { sendEmail } from "@/server/email/mailer";
import type { RunRemindersDeps } from "./run-reminders";

export function createRunRemindersDeps(): RunRemindersDeps {
  const db = getDb();
  return {
    listRecipients: (afterUserId) => listReminderRecipients(db, { afterUserId }),
    claim: (key) => claimReminderDispatch(db, key),
    release: (key) => releaseReminderDispatch(db, key),
    listWeekendMatches: (input) => listUpcomingMatches(db, input),
    send: sendEmail,
    appUrl: getEnv().APP_URL,
    onError: (errorName) => {
      console.error(`[rappels] échec d'un rappel (${errorName})`);
    },
  };
}
