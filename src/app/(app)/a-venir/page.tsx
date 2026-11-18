import { UpcomingMatchList } from "@/components/features/reminders/upcoming-match-list";
import { PageTitle } from "@/components/features/common/page-title";
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { formatShortDate } from "@/lib/weeks";
import { requireUserOrRedirect } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import { listUpcomingMatches } from "@/server/db/upcoming-matches";
import { UPCOMING_LATER_WEEKS, groupByWeek, upcomingRanges } from "@/server/reminders/upcoming";

const t = fr.reminders.upcoming;

/**
 * « À venir » (blocs 7 et 10) : la semaine en cours, d'aujourd'hui au dimanche (matchs de
 * semaine compris), puis les semaines suivantes, regroupées du lundi au dimanche.
 */
export default async function UpcomingPage() {
  // Chaque page vérifie elle-même (§6.2) ; requêtes filtrées par l'utilisateur de la session.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const today = toParisIsoDate(new Date());
  const ranges = upcomingRanges(today);
  const [weekMatches, laterMatches] = await Promise.all([
    listUpcomingMatches(db, { userId: user.id, ...ranges.week }),
    listUpcomingMatches(db, { userId: user.id, ...ranges.later }),
  ]);
  const weeks = groupByWeek(laterMatches);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex max-w-2xl flex-col gap-2">
        <PageTitle>{t.title}</PageTitle>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      <section aria-labelledby="upcoming-week" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="upcoming-week" className="text-xl font-semibold">
            {t.currentWeekTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.currentWeekRange.replace("{sunday}", formatShortDate(ranges.sunday))}
          </p>
        </div>
        {weekMatches.length === 0 ? (
          <p className="rounded-md border border-border p-4">{t.currentWeekEmpty}</p>
        ) : (
          <UpcomingMatchList matches={weekMatches} today={today} />
        )}
      </section>

      <section aria-labelledby="upcoming-later" className="flex flex-col gap-6">
        <h2 id="upcoming-later" className="text-xl font-semibold">
          {t.laterTitle.replace("{weeks}", String(UPCOMING_LATER_WEEKS))}
        </h2>
        {weeks.length === 0 ? (
          <p className="rounded-md border border-border p-4">{t.laterEmpty}</p>
        ) : (
          weeks.map((week) => (
            <section
              key={week.monday}
              aria-labelledby={`week-${week.monday}`}
              className="flex flex-col gap-3"
            >
              {/* Largeur normale : en petit, la largeur resserrée des titres devient illisible. */}
              <h3
                id={`week-${week.monday}`}
                className="text-sm font-medium text-muted-foreground [font-stretch:100%]"
              >
                {t.weekTitle
                  .replace("{monday}", formatShortDate(week.monday))
                  .replace("{sunday}", formatShortDate(week.sunday))}
              </h3>
              <UpcomingMatchList matches={week.matches} today={today} />
            </section>
          ))
        )}
      </section>
    </div>
  );
}
