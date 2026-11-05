import Link from "next/link";
import { fr } from "@/i18n/fr";
import { SETTINGS_PATH, UPCOMING_PATH } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatShortDate } from "@/lib/weeks";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listCompensationsInRange } from "@/server/db/compensations";
import { getDb } from "@/server/db/pool";
import { getReminderSettings } from "@/server/db/reminders";
import { availabilityTargetSaturday } from "@/server/reminders/schedule";
import { upcomingRanges } from "@/server/reminders/upcoming";

const t = fr.reminders.home;

function weekendCountLabel(count: number): string {
  if (count === 0) return t.weekendNone;
  if (count === 1) return t.weekendOne;
  return t.weekendMany.replace("{count}", String(count));
}

export default async function HomePage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const today = toParisIsoDate(new Date());
  const [settings, weekendMatches] = await Promise.all([
    getReminderSettings(db, user.id),
    listCompensationsInRange(db, { userId: user.id, ...upcomingRanges(today).weekend }),
  ]);
  // Rappel visible dans l'application (§5.2) : le même weekend que l'email de la semaine.
  const reminderSaturday =
    settings?.availabilityReminderEnabled === true
      ? availabilityTargetSaturday(today, settings.availabilityReminderWeeks)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{fr.app.name}</h1>
        <p>{fr.auth.signedInAs.replace("{email}", user.email)}</p>
      </section>

      {reminderSaturday !== null && (
        <section
          aria-labelledby="home-availability"
          className="flex flex-col gap-2 rounded-md border border-warning bg-warning/15 p-4"
        >
          <p id="home-availability" className="font-medium">
            {t.availability.replace("{date}", formatShortDate(reminderSaturday))}
          </p>
          <Link
            href={SETTINGS_PATH}
            className="inline-flex min-h-11 items-center self-start underline"
          >
            {t.settingsLink}
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-md border border-border p-4">
        <p className="font-medium">{weekendCountLabel(weekendMatches.length)}</p>
        <Link
          href={UPCOMING_PATH}
          className="inline-flex min-h-11 items-center self-start underline"
        >
          {t.seeUpcoming}
        </Link>
      </section>
    </div>
  );
}
