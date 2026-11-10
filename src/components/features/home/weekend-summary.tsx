/**
 * Matchs du weekend sur l'accueil (bloc 10) : version courte de « À venir ». Depuis le
 * bloc 13, mêmes cartes que la page « À venir » (colonne de date, « Itinéraire » en bouton),
 * sans le menu « ⋯ » : les autres actions restent sur la page.
 */
import Link from "next/link";
import { UpcomingMatchList } from "@/components/features/reminders/upcoming-match-list";
import { fr } from "@/i18n/fr";
import { UPCOMING_PATH } from "@/lib/app-paths";
import { addDays, formatShortDate } from "@/lib/weeks";
import type { UpcomingMatchRow } from "@/server/db/upcoming-matches";

const t = fr.home;

type Props = {
  /** Samedi du weekend affiché (`AAAA-MM-JJ`) ; le weekend va du vendredi au dimanche. */
  saturday: string;
  /** Jour de Paris (`AAAA-MM-JJ`), pour « Demain », « Dans 3 jours ». */
  today: string;
  matches: readonly UpcomingMatchRow[];
};

export function WeekendSummary({ saturday, today, matches }: Props) {
  return (
    <section aria-labelledby="home-weekend" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="home-weekend" className="text-xl font-semibold">
          {t.weekendTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.weekendRange
            .replace("{friday}", formatShortDate(addDays(saturday, -1)))
            .replace("{sunday}", formatShortDate(addDays(saturday, 1)))}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-md border border-border p-4">{fr.reminders.home.weekendNone}</p>
      ) : (
        <UpcomingMatchList matches={matches} today={today} withActions={false} />
      )}

      <Link href={UPCOMING_PATH} className="inline-flex min-h-11 items-center self-start underline">
        {fr.reminders.home.seeUpcoming}
      </Link>
    </section>
  );
}
