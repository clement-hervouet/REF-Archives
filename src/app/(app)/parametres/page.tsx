import { notFound } from "next/navigation";
import { ReminderSettingsForm } from "@/components/features/reminders/reminder-settings-form";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import { getReminderSettings } from "@/server/db/reminders";
import { updateReminderSettingsAction } from "./actions";

const t = fr.reminders.settings;

export default async function SettingsPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const settings = await getReminderSettings(getDb(), user.id);
  if (settings === null) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">{t.intro}</p>
      </section>
      <ReminderSettingsForm settings={settings} action={updateReminderSettingsAction} />
    </div>
  );
}
