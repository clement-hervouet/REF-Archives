/**
 * Matchs du weekend sur l'accueil (bloc 10) : version courte de « À venir » — quand, qui,
 * où, avec qui, et l'itinéraire. Les autres actions restent sur la page « À venir ».
 */
import Link from "next/link";
import { addressLabel } from "@/components/features/compensations/address-label";
import { officialsSummary } from "@/components/features/games/officials-summary";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { UPCOMING_PATH } from "@/lib/app-paths";
import { formatWeekdayDateTime } from "@/lib/format";
import { itineraryUrl } from "@/lib/itinerary";
import { addDays, formatShortDate } from "@/lib/weeks";
import type { UpcomingMatchRow } from "@/server/db/upcoming-matches";

const t = fr.home;

type Props = {
  /** Samedi du weekend affiché (`AAAA-MM-JJ`) ; le weekend va du vendredi au dimanche. */
  saturday: string;
  matches: readonly UpcomingMatchRow[];
};

export function WeekendSummary({ saturday, matches }: Props) {
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
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {matches.map((match) => {
            const address = addressLabel(match.address);
            const officials = officialsSummary(match.officials);
            return (
              <li key={match.id} className="flex flex-col gap-1 p-4">
                <p className="text-sm font-medium first-letter:uppercase">
                  {formatWeekdayDateTime(match.startsAt)}
                </p>
                <p className="text-lg leading-snug font-semibold break-words [font-stretch:85%]">
                  {fr.compensations.list.teams
                    .replace("{team1}", match.team1Name)
                    .replace("{team2}", match.team2Name)}
                </p>
                <p className="text-sm text-muted-foreground">{divisionLabel(match.division)}</p>
                <p className="text-sm break-words">{address}</p>
                {officials !== null && (
                  <p className="text-sm break-words">
                    {t.weekendOfficials.replace("{officials}", officials)}
                  </p>
                )}
                <a
                  href={itineraryUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.itineraryLabel.replace("{address}", address)}
                  className="inline-flex min-h-11 items-center self-start text-sm underline"
                >
                  {t.itinerary}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <Link href={UPCOMING_PATH} className="inline-flex min-h-11 items-center self-start underline">
        {fr.reminders.home.seeUpcoming}
      </Link>
    </section>
  );
}
