/**
 * Schéma du formulaire « Paramètres » des rappels (§6.3). Une case cochée envoie `on`,
 * une case décochée n'envoie rien : toute autre valeur est refusée.
 */
import { z } from "zod";
import {
  MAX_AVAILABILITY_REMINDER_WEEKS,
  MIN_AVAILABILITY_REMINDER_WEEKS,
  type ReminderSettings,
} from "@/server/reminders/schedule";

const checkboxSchema = z
  .literal("on")
  .nullable()
  .transform((value) => value === "on");

const weeksSchema = z
  .string()
  .trim()
  .regex(/^\d{1,2}$/)
  .transform(Number)
  .pipe(z.number().int().min(MIN_AVAILABILITY_REMINDER_WEEKS).max(MAX_AVAILABILITY_REMINDER_WEEKS));

export const reminderSettingsFormSchema = z.object({
  availabilityReminderEnabled: checkboxSchema,
  availabilityReminderWeeks: weeksSchema,
  weekendRecapEnabled: checkboxSchema,
});

/** Lit et valide le formulaire ; `null` si une valeur est invalide (formulaire modifié à la main). */
export function parseReminderSettingsForm(formData: FormData): ReminderSettings | null {
  const result = reminderSettingsFormSchema.safeParse({
    availabilityReminderEnabled: formData.get("availabilityReminderEnabled"),
    availabilityReminderWeeks: formData.get("availabilityReminderWeeks"),
    weekendRecapEnabled: formData.get("weekendRecapEnabled"),
  });
  return result.success ? result.data : null;
}
