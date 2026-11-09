"use client";

/**
 * Formulaire « Paramètres » des rappels. Le délai est une liste fermée (1 à 12 semaines) :
 * pas de saisie libre à valider côté client, le serveur revalide quand même (§6.3).
 */
import { useId } from "react";
import { FormMessage, PRIMARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import {
  MAX_AVAILABILITY_REMINDER_WEEKS,
  MIN_AVAILABILITY_REMINDER_WEEKS,
  type ReminderSettings,
} from "@/server/reminders/schedule";
import type { ReminderSettingsState } from "@/server/reminders/settings";
import { reminderSettingsMessage, weeksOptionLabel } from "./reminder-messages";

const t = fr.reminders.settings;

const WEEK_OPTIONS = Array.from(
  { length: MAX_AVAILABILITY_REMINDER_WEEKS - MIN_AVAILABILITY_REMINDER_WEEKS + 1 },
  (_, index) => MIN_AVAILABILITY_REMINDER_WEEKS + index,
);

const CHECKBOX_LABEL_CLASS = "flex min-h-11 cursor-pointer items-center gap-3";
const CHECKBOX_CLASS = "size-5 shrink-0";

type Props = {
  settings: ReminderSettings;
  action: (previous: ReminderSettingsState, formData: FormData) => Promise<ReminderSettingsState>;
};

export function ReminderSettingsForm({ settings, action }: Props) {
  const id = useId();
  // Les valeurs affichées viennent toujours de la base (props rafraîchies après l'envoi) :
  // le formulaire est remonté à chaque envoi pour les reprendre.
  const { state, formKey, formAction, isPending } = useScaleForm(action, { status: "idle" }, [
    "saved",
  ]);
  const weeksId = `${id}-weeks`;
  const weeksHintId = `${id}-weeks-hint`;
  const recapHintId = `${id}-recap-hint`;

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={reminderSettingsMessage(state.status)} />
      <form key={formKey} action={formAction} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3 rounded-md border border-border p-4">
          <legend className="px-1 font-semibold">{t.availability.legend}</legend>
          <label className={CHECKBOX_LABEL_CLASS}>
            <input
              type="checkbox"
              name="availabilityReminderEnabled"
              defaultChecked={settings.availabilityReminderEnabled}
              className={CHECKBOX_CLASS}
            />
            <span>{t.availability.enabled}</span>
          </label>
          <div className="flex flex-col gap-1">
            <label htmlFor={weeksId} className="text-sm font-medium">
              {t.availability.weeks}
            </label>
            <select
              id={weeksId}
              name="availabilityReminderWeeks"
              defaultValue={String(settings.availabilityReminderWeeks)}
              aria-describedby={weeksHintId}
              className="min-h-11 w-full rounded-md border border-input px-3 py-2 md:w-72"
            >
              {WEEK_OPTIONS.map((weeks) => (
                <option key={weeks} value={String(weeks)}>
                  {weeksOptionLabel(weeks)}
                </option>
              ))}
            </select>
            <p id={weeksHintId} className="text-sm text-muted-foreground">
              {t.availability.hint}
            </p>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-md border border-border p-4">
          <legend className="px-1 font-semibold">{t.weekendRecap.legend}</legend>
          <label className={CHECKBOX_LABEL_CLASS}>
            <input
              type="checkbox"
              name="weekendRecapEnabled"
              defaultChecked={settings.weekendRecapEnabled}
              aria-describedby={recapHintId}
              className={CHECKBOX_CLASS}
            />
            <span>{t.weekendRecap.enabled}</span>
          </label>
          <p id={recapHintId} className="text-sm text-muted-foreground">
            {t.weekendRecap.hint}
          </p>
        </fieldset>

        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
