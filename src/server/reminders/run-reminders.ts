/**
 * Job des rappels (§5.2, §9), appelé une fois par jour par la route `/api/cron/reminders`.
 *
 * Pour chaque compte ayant un rappel activé : calcule les rappels dus (règles pures de
 * `schedule.ts`), réserve chaque envoi AVANT de l'envoyer (idempotence), puis libère la
 * réservation si l'envoi échoue, pour réessayer au passage suivant. L'échec d'un envoi
 * n'interrompt jamais le job : les autres comptes sont traités.
 */
import { toParisIsoDate } from "@/lib/dates";
import type { EmailMessage } from "@/lib/schemas/email";
import { parisWeekendRange } from "@/lib/weeks";
import {
  REMINDER_RECIPIENTS_PAGE_SIZE,
  type ReminderDispatchKey,
  type ReminderRecipient,
} from "@/server/db/reminders";
import { buildAvailabilityReminderEmail } from "@/server/email/availability-reminder-email";
import { type WeekendMatch, buildWeekendRecapEmail } from "@/server/email/weekend-recap-email";
import { type DueReminder, dueReminders } from "./schedule";

export type RunRemindersDeps = {
  /** Page suivante de destinataires (voir `listReminderRecipients`). */
  listRecipients: (afterUserId: string | null) => Promise<ReminderRecipient[]>;
  claim: (key: ReminderDispatchKey) => Promise<boolean>;
  release: (key: ReminderDispatchKey) => Promise<void>;
  /** Indemnités actives du compte dont le match commence dans `[from, to)`. */
  listWeekendMatches: (input: { userId: string; from: Date; to: Date }) => Promise<WeekendMatch[]>;
  send: (message: EmailMessage) => Promise<void>;
  /** `APP_URL` validée (jamais l'en-tête Host). */
  appUrl: string;
  /** Reçoit uniquement le NOM de l'erreur : son message pourrait contenir une adresse. */
  onError: (errorName: string) => void;
};

export type ReminderOutcome = "sent" | "alreadySent" | "nothingToSend" | "failed";

export type RunRemindersResult = Record<ReminderOutcome, number>;

/** Construit l'email d'un rappel dû, ou `null` s'il n'y a rien à envoyer (weekend sans match). */
async function buildReminderMessage(
  deps: RunRemindersDeps,
  recipient: ReminderRecipient,
  reminder: DueReminder,
): Promise<EmailMessage | null> {
  if (reminder.kind === "availability") {
    return buildAvailabilityReminderEmail({
      email: recipient.email,
      weekendSaturday: reminder.weekendSaturday,
      appUrl: deps.appUrl,
    });
  }
  const range = parisWeekendRange(reminder.periodStart);
  const matches = await deps.listWeekendMatches({ userId: recipient.userId, ...range });
  if (matches.length === 0) {
    // Pas de réservation : si un match est saisi d'ici samedi, le récapitulatif partira.
    return null;
  }
  return buildWeekendRecapEmail({
    email: recipient.email,
    saturday: reminder.periodStart,
    matches,
    appUrl: deps.appUrl,
  });
}

/** Traite un rappel dû. Ne lève jamais d'erreur : un échec est compté et signalé. */
export async function processReminder(
  deps: RunRemindersDeps,
  recipient: ReminderRecipient,
  reminder: DueReminder,
): Promise<ReminderOutcome> {
  try {
    const message = await buildReminderMessage(deps, recipient, reminder);
    if (message === null) {
      return "nothingToSend";
    }
    const key = {
      userId: recipient.userId,
      kind: reminder.kind,
      periodStart: reminder.periodStart,
    };
    if (!(await deps.claim(key))) {
      return "alreadySent";
    }
    try {
      await deps.send(message);
    } catch (error: unknown) {
      // Si la libération échoue aussi, ce rappel est perdu pour la période : on le signale.
      await deps.release(key).catch((releaseError: unknown) => {
        deps.onError(releaseError instanceof Error ? releaseError.name : "UnknownError");
      });
      throw error;
    }
    return "sent";
  } catch (error: unknown) {
    deps.onError(error instanceof Error ? error.name : "UnknownError");
    return "failed";
  }
}

/** Exécute le job pour l'instant `now` et renvoie le décompte des rappels traités. */
export async function runReminders(deps: RunRemindersDeps, now: Date): Promise<RunRemindersResult> {
  const today = toParisIsoDate(now);
  const result: RunRemindersResult = { sent: 0, alreadySent: 0, nothingToSend: 0, failed: 0 };
  let afterUserId: string | null = null;
  let hasMore = true;
  while (hasMore) {
    const page = await deps.listRecipients(afterUserId);
    for (const recipient of page) {
      for (const reminder of dueReminders(today, recipient.settings)) {
        result[await processReminder(deps, recipient, reminder)] += 1;
      }
    }
    afterUserId = page.at(-1)?.userId ?? null;
    hasMore = page.length === REMINDER_RECIPIENTS_PAGE_SIZE && afterUserId !== null;
  }
  return result;
}
