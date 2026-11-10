/**
 * Matchs à venir (page « À venir », blocs 7 et 10) : quand (avec « Demain », « Dans 5
 * jours »), qui, niveau, lieu, officiels du match complet. « Itinéraire » reste visible ;
 * agenda, match et modification sont dans le menu « ⋯ ». Aussi utilisée, sans le menu,
 * pour les matchs du weekend de l'accueil (bloc 13). Ni montant ni barème : c'est une
 * fiche pratique pour se rendre au match.
 */
import Link from "next/link";
import { ActionsMenu } from "@/components/features/compensations/actions-menu";
import { addressLabel } from "@/components/features/compensations/address-label";
import { MatchDate } from "@/components/features/compensations/match-date";
import { MENU_ITEM_CLASS } from "@/components/features/compensations/menu-styles";
import { officialsSummary } from "@/components/features/games/officials-summary";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { completeGamePath, gamePath, matchExportPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { itineraryUrl } from "@/lib/itinerary";
import type { UpcomingMatchRow } from "@/server/db/upcoming-matches";
import { relativeDay } from "@/server/reminders/upcoming";

const t = fr.reminders.upcoming;

export type UpcomingMatch = UpcomingMatchRow;

/** Au-delà, le titre de la semaine suffit : la mention ne dirait rien de plus. */
const RELATIVE_LABEL_MAX_DAYS = 6;

/** « Aujourd'hui », « Demain », « Dans 5 jours » (6 jours au plus), sinon rien. */
function relativeLabel(today: string, startsAt: Date): string | null {
  const relative = relativeDay(today, startsAt);
  switch (relative.kind) {
    case "today":
      return t.today;
    case "tomorrow":
      return t.tomorrow;
    case "days":
      return relative.days <= RELATIVE_LABEL_MAX_DAYS
        ? t.inDays.replace("{count}", String(relative.days))
        : null;
    case "past":
      return null;
  }
}

type CardProps = {
  match: UpcomingMatch;
  today: string;
  /** Faux sur l'accueil (bloc 13) : « Itinéraire » seul, les autres actions restent sur « À venir ». */
  withActions: boolean;
};

function UpcomingMatchCard({ match, today, withActions }: CardProps) {
  const address = addressLabel(match.address);
  const date = formatIsoDate(toParisIsoDate(match.startsAt));
  const officials = officialsSummary(match.officials);
  return (
    <article className="relative grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <MatchDate startsAt={match.startsAt} note={relativeLabel(today, match.startsAt)} />

      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold break-words">
          {t.teams.replace("{team1}", match.team1Name).replace("{team2}", match.team2Name)}
        </h3>
        <p className="text-sm text-muted-foreground">{divisionLabel(match.division)}</p>
        <p className="text-sm break-words">{address}</p>
        {officials !== null && (
          <p className="text-sm break-words">{t.officials.replace("{officials}", officials)}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 md:items-start">
        <a
          href={itineraryUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.itineraryLabel.replace("{address}", address)}
          className="inline-flex min-h-11 items-center rounded-md border border-input px-4"
        >
          {t.itinerary}
        </a>
        {withActions && (
          <ActionsMenu ariaLabel={fr.compensations.list.moreActionsLabel.replace("{date}", date)}>
            {/* `<a>` et non `<Link>` : c'est un fichier à télécharger, pas une page. */}
            <a
              href={matchExportPath(match.id)}
              download
              data-close-menu
              aria-label={fr.calendar.export.ariaLabel.replace("{date}", date)}
              className={MENU_ITEM_CLASS}
            >
              {fr.calendar.export.label}
            </a>
            {match.gameId === null ? (
              <Link
                href={completeGamePath(match.id)}
                data-close-menu
                aria-label={fr.games.completeMatchLabel.replace("{date}", date)}
                className={MENU_ITEM_CLASS}
              >
                {fr.games.completeMatch}
              </Link>
            ) : (
              <Link
                href={gamePath(match.gameId)}
                data-close-menu
                aria-label={fr.games.viewMatchLabel.replace("{date}", date)}
                className={MENU_ITEM_CLASS}
              >
                {fr.games.viewMatch}
              </Link>
            )}
            <Link
              href={`/indemnites/${match.id}/modifier`}
              data-close-menu
              aria-label={t.editLabel.replace("{date}", date)}
              className={MENU_ITEM_CLASS}
            >
              {t.edit}
            </Link>
          </ActionsMenu>
        )}
      </div>
    </article>
  );
}

type Props = {
  matches: readonly UpcomingMatch[];
  /** Jour de Paris (`AAAA-MM-JJ`), pour « Demain », « Dans 5 jours ». */
  today: string;
  /** Menu « ⋯ » (agenda, match, modification) : vrai par défaut, faux sur l'accueil. */
  withActions?: boolean;
};

export function UpcomingMatchList({ matches, today, withActions = true }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {matches.map((match) => (
        <li key={match.id}>
          <UpcomingMatchCard match={match} today={today} withActions={withActions} />
        </li>
      ))}
    </ul>
  );
}
