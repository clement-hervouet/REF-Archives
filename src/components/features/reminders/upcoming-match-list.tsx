/**
 * Matchs à venir (page « À venir », blocs 7 et 10) : quand (avec « Demain », « Dans 5
 * jours »), qui, niveau, lieu, officiels du match complet. « Itinéraire » reste visible
 * quand l'adresse est complète (rue, code postal, ville : une adresse de club peut n'avoir
 * que son code postal, §15.4.1) ; agenda, match et modification sont dans le menu « ⋯ ». Aussi utilisée, sans le menu,
 * pour les matchs du weekend de l'accueil (bloc 13). Ni montant ni barème : c'est une
 * fiche pratique pour se rendre au match.
 */
import { withTeams } from "@/lib/match-teams";
import Link from "next/link";
import { ActionsMenu } from "@/components/features/compensations/actions-menu";
import { addressLabel, isCompleteAddress } from "@/components/features/compensations/address-label";
import { MatchDate } from "@/components/features/compensations/match-date";
import { MENU_ITEM_CLASS } from "@/components/features/compensations/menu-styles";
import { officialsSummary } from "@/components/features/games/officials-summary";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { PrepareMatchItem } from "@/components/features/games/prepare-match-item";
import { completeGamePath, gamePath, matchExportPath, preparationPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { itineraryUrl } from "@/lib/itinerary";
import type { UpcomingMatchRow } from "@/server/db/upcoming-matches";
import type { PrepareMatchState } from "@/server/games/preparation-form";
import { relativeDay } from "@/server/reminders/upcoming";

const t = fr.reminders.upcoming;

type UpcomingMatch = UpcomingMatchRow;

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

type PrepareAction = (
  previous: PrepareMatchState,
  formData: FormData,
) => Promise<PrepareMatchState>;

type CardProps = {
  match: UpcomingMatch;
  today: string;
  /** Faux sur l'accueil (bloc 13) : « Itinéraire » seul (si l'adresse est complète), les autres actions restent sur « À venir ». */
  withActions: boolean;
  /** « Préparer le match » dans le menu (§15.4.10) ; absent : pas d'entrée de préparation. */
  prepareAction: PrepareAction | undefined;
};

/** Entrée « préparation » du menu : rien pour un plateau (§15.4.10). */
function PreparationMenuItem({
  match,
  date,
  prepareAction,
}: {
  match: UpcomingMatch;
  date: string;
  prepareAction: PrepareAction;
}) {
  if (match.team2Name === null) {
    return null;
  }
  if (match.gameId === null) {
    return <PrepareMatchItem compensationId={match.id} dateLabel={date} action={prepareAction} />;
  }
  const preparation = fr.preparations;
  return (
    <Link
      href={preparationPath(match.gameId)}
      data-close-menu
      aria-label={(match.hasPreparation ? preparation.viewLabel : preparation.prepareLabel).replace(
        "{date}",
        date,
      )}
      className={MENU_ITEM_CLASS}
    >
      {match.hasPreparation ? preparation.view : preparation.prepare}
    </Link>
  );
}

function UpcomingMatchCard({ match, today, withActions, prepareAction }: CardProps) {
  const address = addressLabel(match.address);
  const date = formatIsoDate(toParisIsoDate(match.startsAt));
  const officials = officialsSummary(match.officials);
  const withItinerary = isCompleteAddress(match.address);
  return (
    <article className="relative grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <MatchDate startsAt={match.startsAt} note={relativeLabel(today, match.startsAt)} />

      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold break-words">
          {withTeams(t.teams, match.team1Name, match.team2Name)}
        </h3>
        <p className="text-sm text-muted-foreground">{matchLevelLabel(match.division)}</p>
        <p className="text-sm break-words">{address}</p>
        {officials !== null && (
          <p className="text-sm break-words">{t.officials.replace("{officials}", officials)}</p>
        )}
        {withActions && match.hasPreparation && (
          <p className="text-sm font-medium">{fr.preparations.done}</p>
        )}
      </div>

      {(withItinerary || withActions) && (
        <div className="flex flex-wrap items-center gap-1 md:items-start">
          {withItinerary && (
            <a
              href={itineraryUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.itineraryLabel.replace("{address}", address)}
              className="inline-flex min-h-11 items-center rounded-md border border-input px-4"
            >
              {t.itinerary}
            </a>
          )}
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
              {prepareAction !== undefined && (
                <PreparationMenuItem match={match} date={date} prepareAction={prepareAction} />
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
      )}
    </article>
  );
}

type Props = {
  matches: readonly UpcomingMatch[];
  /** Jour de Paris (`AAAA-MM-JJ`), pour « Demain », « Dans 5 jours ». */
  today: string;
  /** Menu « ⋯ » (agenda, match, modification) : vrai par défaut, faux sur l'accueil. */
  withActions?: boolean;
  /** « Préparer le match » (§15.4.10), page « À venir » seulement. */
  prepareAction?: PrepareAction;
};

export function UpcomingMatchList({ matches, today, withActions = true, prepareAction }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {matches.map((match) => (
        <li key={match.id}>
          <UpcomingMatchCard
            match={match}
            today={today}
            withActions={withActions}
            prepareAction={prepareAction}
          />
        </li>
      ))}
    </ul>
  );
}
