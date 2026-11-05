/**
 * Matchs à venir (page « À venir ») : heure, équipes, niveau, lieu, officiels du match
 * complet (bloc 9), lien d'itinéraire et export du match vers un agenda (fichier `.ics`).
 * Ni montant ni barème : c'est une fiche pratique pour se rendre au match.
 */
import Link from "next/link";
import { addressLabel } from "@/components/features/compensations/address-label";
import { officialsSummary } from "@/components/features/games/officials-summary";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { completeGamePath, gamePath, matchExportPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatWeekdayDateTime } from "@/lib/format";
import { itineraryUrl } from "@/lib/itinerary";
import { formatShortDate } from "@/lib/weeks";
import type { UpcomingMatchRow } from "@/server/db/upcoming-matches";

const t = fr.reminders.upcoming;

const LINK_CLASS = "inline-flex min-h-11 items-center rounded-md border border-input px-4";

export type UpcomingMatch = UpcomingMatchRow;

export function UpcomingMatchList({ matches }: { matches: readonly UpcomingMatch[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {matches.map((match) => {
        const address = addressLabel(match.address);
        const date = formatShortDate(toParisIsoDate(match.startsAt));
        const officials = officialsSummary(match.officials);
        return (
          <li key={match.id}>
            <article className="flex flex-col gap-3 rounded-md border border-border p-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium first-letter:uppercase">
                  {formatWeekdayDateTime(match.startsAt)}
                </p>
                <h3 className="font-semibold break-words">
                  {t.teams.replace("{team1}", match.team1Name).replace("{team2}", match.team2Name)}
                </h3>
                <p className="text-sm text-muted-foreground">{divisionLabel(match.division)}</p>
                <p className="text-sm break-words">{address}</p>
                {officials !== null && (
                  <p className="text-sm break-words">
                    {t.officials.replace("{officials}", officials)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <a
                  href={itineraryUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.itineraryLabel.replace("{address}", address)}
                  className={LINK_CLASS}
                >
                  {t.itinerary}
                </a>
                {/* `<a>` et non `<Link>` : c'est un fichier à télécharger, pas une page. */}
                <a
                  href={matchExportPath(match.id)}
                  download
                  aria-label={fr.calendar.export.ariaLabel.replace("{date}", date)}
                  className={LINK_CLASS}
                >
                  {fr.calendar.export.label}
                </a>
                {match.gameId === null ? (
                  <Link
                    href={completeGamePath(match.id)}
                    aria-label={fr.games.completeMatchLabel.replace("{date}", date)}
                    className={LINK_CLASS}
                  >
                    {fr.games.completeMatch}
                  </Link>
                ) : (
                  <Link
                    href={gamePath(match.gameId)}
                    aria-label={fr.games.viewMatchLabel.replace("{date}", date)}
                    className={LINK_CLASS}
                  >
                    {fr.games.viewMatch}
                  </Link>
                )}
                <Link
                  href={`/indemnites/${match.id}/modifier`}
                  aria-label={t.editLabel.replace("{date}", date)}
                  className={LINK_CLASS}
                >
                  {t.edit}
                </Link>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
