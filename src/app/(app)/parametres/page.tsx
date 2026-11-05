import { notFound } from "next/navigation";
import { CalendarFeedSection } from "@/components/features/calendar/calendar-feed-section";
import { ReminderSettingsForm } from "@/components/features/reminders/reminder-settings-form";
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { requireUserOrRedirect } from "@/server/auth/session";
import { getCalendarFeedStatus } from "@/server/db/calendar-feeds";
import { getDb } from "@/server/db/pool";
import { getReminderSettings } from "@/server/db/reminders";
import { updateReminderSettingsAction } from "./actions";
import { manageCalendarFeedAction } from "./calendar-actions";

const t = fr.reminders.settings;

export default async function SettingsPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const [settings, feed] = await Promise.all([
    getReminderSettings(db, user.id),
    getCalendarFeedStatus(db, user.id),
  ]);
  if (settings === null) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-6">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-neutral-700">{t.intro}</p>
        </div>
        <ReminderSettingsForm settings={settings} action={updateReminderSettingsAction} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{fr.calendar.settings.title}</h2>
        <CalendarFeedSection
          activeSince={feed === null ? null : formatIsoDate(toParisIsoDate(feed.createdAt))}
          action={manageCalendarFeedAction}
        />
      </section>
    </div>
  );
}
