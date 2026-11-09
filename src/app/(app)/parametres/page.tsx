import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/features/account/profile-form";
import { ThemeForm } from "@/components/features/account/theme-form";
import { CalendarFeedSection } from "@/components/features/calendar/calendar-feed-section";
import { ReminderSettingsForm } from "@/components/features/reminders/reminder-settings-form";
import { SettingsSection } from "@/components/features/settings/settings-section";
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { THEME_COOKIE, themePreferenceFromCookie } from "@/lib/theme";
import { requireUserOrRedirect } from "@/server/auth/session";
import { getCalendarFeedStatus } from "@/server/db/calendar-feeds";
import { getDb } from "@/server/db/pool";
import { getReminderSettings } from "@/server/db/reminders";
import { updateReminderSettingsAction } from "./actions";
import { manageCalendarFeedAction } from "./calendar-actions";
import { updateProfileAction } from "./profile-actions";
import { updateThemeAction } from "./theme-actions";

const t = fr.reminders.settings;
const account = fr.profile.settings;
const calendar = fr.calendar.settings;

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
  const theme = themePreferenceFromCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.title}</h1>

      <SettingsSection
        id="settings-account"
        title={account.title}
        description={account.description}
      >
        <dl className="flex flex-col gap-1">
          <dt className="text-sm font-medium">{account.emailLabel}</dt>
          <dd className="flex min-h-11 items-center rounded-md border border-border bg-muted/40 px-3 break-all">
            {user.email}
          </dd>
          <dd className="text-sm text-muted-foreground">{account.emailHint}</dd>
        </dl>
        <ProfileForm
          profile={{ firstname: user.firstname, lastname: user.lastname }}
          action={updateProfileAction}
          submitLabel={account.submit}
          submittingLabel={account.submitting}
        />
      </SettingsSection>

      <SettingsSection id="settings-theme" title={fr.theme.title} description={fr.theme.hint}>
        <ThemeForm current={theme} action={updateThemeAction} />
      </SettingsSection>

      <SettingsSection id="settings-reminders" title={t.sectionTitle} description={t.intro}>
        <ReminderSettingsForm settings={settings} action={updateReminderSettingsAction} />
      </SettingsSection>

      <SettingsSection
        id="settings-calendar"
        title={calendar.title}
        description={
          <>
            <p>{calendar.intro}</p>
            <p>{calendar.content}</p>
          </>
        }
      >
        <CalendarFeedSection
          activeSince={feed === null ? null : formatIsoDate(toParisIsoDate(feed.createdAt))}
          action={manageCalendarFeedAction}
        />
      </SettingsSection>
    </div>
  );
}
