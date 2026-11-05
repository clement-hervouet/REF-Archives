/**
 * Matchs à venir (page « À venir ») : heure, équipes, niveau, lieu, lien d'itinéraire et
 * export du match vers un agenda (fichier `.ics`).
 * Ni montant ni barème : c'est une fiche pratique pour se rendre au match.
 */
import Link from "next/link";
import { addressLabel } from "@/components/features/compensations/address-label";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { matchExportPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatWeekdayDateTime } from "@/lib/format";
import { itineraryUrl } from "@/lib/itinerary";
import { formatShortDate } from "@/lib/weeks";
import type { CompensationListItem } from "@/server/db/compensations";

const t = fr.reminders.upcoming;

const LINK_CLASS = "inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4";

export type UpcomingMatch = Pick<
  CompensationListItem,
  "id" | "startsAt" | "team1Name" | "team2Name" | "division" | "address"
>;

export function UpcomingMatchList({ matches }: { matches: readonly UpcomingMatch[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {matches.map((match) => {
        const address = addressLabel(match.address);
        const date = formatShortDate(toParisIsoDate(match.startsAt));
        return (
          <li key={match.id}>
            <article className="flex flex-col gap-3 rounded-md border border-neutral-300 p-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium first-letter:uppercase">
                  {formatWeekdayDateTime(match.startsAt)}
                </p>
                <h3 className="font-semibold break-words">
                  {t.teams.replace("{team1}", match.team1Name).replace("{team2}", match.team2Name)}
                </h3>
                <p className="text-sm text-neutral-700">{divisionLabel(match.division)}</p>
                <p className="text-sm break-words">{address}</p>
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
