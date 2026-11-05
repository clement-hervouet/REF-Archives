"use server";

/**
 * Server Action de la page « Paramètres ». Vérifie la session en base (§6.2) ; seul
 * l'utilisateur connecté est modifié : son id vient de la session, jamais du formulaire.
 */
import { revalidatePath } from "next/cache";
import { SETTINGS_PATH } from "@/lib/app-paths";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import { updateReminderSettings } from "@/server/db/reminders";
import {
  type ReminderSettingsState,
  handleUpdateReminderSettings,
} from "@/server/reminders/settings";

export async function updateReminderSettingsAction(
  _previous: ReminderSettingsState,
  formData: FormData,
): Promise<ReminderSettingsState> {
  const user = await requireUser();
  const db = getDb();
  const state = await handleUpdateReminderSettings(
    { update: (userId, settings) => updateReminderSettings(db, userId, settings) },
    user.id,
    formData,
  );
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/");
  return state;
}
