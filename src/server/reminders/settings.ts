/**
 * Logique du formulaire « Paramètres » : validation puis enregistrement. Ni Next.js ni
 * authentification ici : la Server Action vérifie la session et fournit l'utilisateur
 * (jamais lu dans le formulaire, §6.2). Dépendances injectées : testable sans base.
 */
import { parseReminderSettingsForm } from "@/lib/schemas/reminders";
import type { ReminderSettings } from "./schedule";

export type ReminderSettingsState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "saved" };

export type ReminderSettingsDeps = {
  update: (userId: string, settings: ReminderSettings) => Promise<boolean>;
};

export async function handleUpdateReminderSettings(
  deps: ReminderSettingsDeps,
  userId: string,
  formData: FormData,
): Promise<ReminderSettingsState> {
  const settings = parseReminderSettingsForm(formData);
  if (settings === null) {
    return { status: "invalid" };
  }
  return (await deps.update(userId, settings)) ? { status: "saved" } : { status: "not_found" };
}
