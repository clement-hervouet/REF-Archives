import { UpcomingMatchList } from "@/components/features/reminders/upcoming-match-list";
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { addDays, formatShortDate } from "@/lib/weeks";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listUpcomingMatches } from "@/server/db/upcoming-matches";
import { getDb } from "@/server/db/pool";
import { UPCOMING_LATER_WEEKS, upcomingRanges } from "@/server/reminders/upcoming";

const t = fr.reminders.upcoming;

export default async function UpcomingPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const ranges = upcomingRanges(toParisIsoDate(new Date()));
  // Requêtes filtrées par propriétaire (§5.6) : l'utilisateur vient de la session.
  const [weekendMatches, laterMatches] = await Promise.all([
    listUpcomingMatches(db, { userId: user.id, ...ranges.weekend }),
    listUpcomingMatches(db, { userId: user.id, ...ranges.later }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {t.weekendTitle
            .replace("{saturday}", formatShortDate(ranges.saturday))
            .replace("{sunday}", formatShortDate(addDays(ranges.saturday, 1)))}
        </h2>
        {weekendMatches.length === 0 ? (
          <p>{t.weekendEmpty}</p>
        ) : (
          <UpcomingMatchList matches={weekendMatches} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {t.laterTitle.replace("{weeks}", String(UPCOMING_LATER_WEEKS))}
        </h2>
        {laterMatches.length === 0 ? (
          <p>{t.laterEmpty}</p>
        ) : (
          <UpcomingMatchList matches={laterMatches} />
        )}
      </section>
    </div>
  );
}
