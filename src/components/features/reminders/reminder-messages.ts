/**
 * Message affiché après l'envoi du formulaire « Paramètres ». Pur et sans React.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import type { ReminderSettingsState } from "@/server/reminders/settings";

const t = fr.reminders.settings;

export function reminderSettingsMessage(
  status: ReminderSettingsState["status"],
): ScaleMessage | null {
  switch (status) {
    case "idle":
      return null;
    case "saved":
      return { tone: "success", text: t.saved };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "not_found":
      return { tone: "error", text: t.errors.notFound };
  }
}

/** Libellé d'une option du délai, ex. « 5 semaines à l'avance ». */
export function weeksOptionLabel(weeks: number): string {
  return weeks === 1
    ? t.availability.weeksOne
    : t.availability.weeksMany.replace("{count}", String(weeks));
}
