/**
 * Rappel hebdomadaire des indisponibilités (§5.2) : un email fixe, sans donnée personnelle
 * autre que l'adresse du destinataire. Email non essentiel : il pointe vers les paramètres
 * pour le désactiver (§9).
 */
import { fr } from "@/i18n/fr";
import { SETTINGS_PATH } from "@/lib/app-paths";
import type { EmailMessage } from "@/lib/schemas/email";
import { addDays, formatShortDate } from "@/lib/weeks";
import { renderEmail } from "./layout";

const t = fr.email.availabilityReminder;

export type AvailabilityReminderEmailInput = {
  email: string;
  /** Samedi du weekend visé, `AAAA-MM-JJ`. */
  weekendSaturday: string;
  /** `APP_URL` validée (jamais l'en-tête Host). */
  appUrl: string;
};

/** Construit l'email de rappel des indisponibilités. */
export function buildAvailabilityReminderEmail(
  input: AvailabilityReminderEmailInput,
): EmailMessage {
  const saturday = formatShortDate(input.weekendSaturday);
  const sunday = formatShortDate(addDays(input.weekendSaturday, 1));
  const { text, html } = renderEmail({
    title: t.title,
    paragraphs: [t.body.replace("{saturday}", saturday).replace("{sunday}", sunday)],
    action: {
      label: t.action,
      url: `${input.appUrl}${SETTINGS_PATH}`,
      fallback: fr.email.linkFallback,
    },
    footer: fr.email.reminderFooter,
  });
  return { to: input.email, subject: t.subject.replace("{date}", saturday), text, html };
}
