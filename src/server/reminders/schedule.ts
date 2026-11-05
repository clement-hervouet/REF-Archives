/**
 * Règles pures des rappels (§5.2, §9) : quels emails sont dus pour un utilisateur, un
 * jour donné à Paris. Sans base ni horloge : le job planifié fournit la date du jour et
 * les réglages, puis réserve chaque envoi dans `reminder_dispatch` (idempotence).
 *
 * Le job est appelé chaque jour. Un rappel reste dû pendant toute sa fenêtre et n'est
 * envoyé qu'une fois par période : si le cron saute un jour, l'envoi part le lendemain.
 */
import { addDays, isoWeekday, mondayOf, saturdayOf } from "@/lib/weeks";

/** Délai par défaut du rappel des indisponibilités, en semaines. */
export const DEFAULT_AVAILABILITY_REMINDER_WEEKS = 5;
export const MIN_AVAILABILITY_REMINDER_WEEKS = 1;
export const MAX_AVAILABILITY_REMINDER_WEEKS = 12;

/** Le récapitulatif du weekend part à partir du jeudi… */
export const WEEKEND_RECAP_FIRST_WEEKDAY = 4;
/** … et au plus tard le samedi : après, il n'a plus d'intérêt. */
export const WEEKEND_RECAP_LAST_WEEKDAY = 6;

export type ReminderSettings = {
  availabilityReminderEnabled: boolean;
  availabilityReminderWeeks: number;
  weekendRecapEnabled: boolean;
};

export type DueReminder =
  | {
      kind: "availability";
      /** Lundi de la semaine d'envoi : un seul rappel par semaine. */
      periodStart: string;
      /** Samedi du weekend dont il faut saisir les indisponibilités. */
      weekendSaturday: string;
    }
  | {
      kind: "weekend_recap";
      /** Samedi du weekend récapitulé (du vendredi au dimanche). */
      periodStart: string;
    };

/**
 * Samedi du weekend visé par le rappel envoyé la semaine de `today` : celui de la
 * semaine située `weeks` semaines plus loin.
 */
export function availabilityTargetSaturday(today: string, weeks: number): string {
  return saturdayOf(addDays(mondayOf(today), 7 * weeks));
}

/** Rappels dus le jour `today` (date de Paris) pour un utilisateur. */
export function dueReminders(today: string, settings: ReminderSettings): DueReminder[] {
  const due: DueReminder[] = [];
  if (settings.availabilityReminderEnabled) {
    due.push({
      kind: "availability",
      periodStart: mondayOf(today),
      weekendSaturday: availabilityTargetSaturday(today, settings.availabilityReminderWeeks),
    });
  }
  const weekday = isoWeekday(today);
  const inRecapWindow =
    weekday >= WEEKEND_RECAP_FIRST_WEEKDAY && weekday <= WEEKEND_RECAP_LAST_WEEKDAY;
  if (settings.weekendRecapEnabled && inRecapWindow) {
    due.push({ kind: "weekend_recap", periodStart: saturdayOf(today) });
  }
  return due;
}
