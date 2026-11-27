/**
 * Matchs à venir (blocs 7 et 10), sur la page « À venir » et pour la semaine de l'accueil
 * (bloc 13) : quand (avec « Demain », « Dans 5 jours »), qui, niveau, officiels du match
 * complet. La date est posée sur la bordure de la carte, comme la légende d'un `<fieldset>`.
 * Pas de ligne d'adresse : sous le niveau, place aux collègues. Le menu « ⋯ », en bulle dans
 * le coin, porte « Itinéraire » (adresse complète : rue, code postal, ville ; une adresse de
 * club peut n'avoir que son code postal, §15.4.1), le match, la préparation et la
 * modification ; pas « Ajouter à l'agenda », l'abonnement s'en charge. Ni montant ni
 * barème : c'est une fiche pratique pour se rendre au match.
 */
import Link from "next/link";
import { MatchClubBadges } from "@/components/features/clubs/club-badge";
import { ActionsMenu } from "@/components/features/compensations/actions-menu";
import { addressLabel, isCompleteAddress } from "@/components/features/compensations/address-label";
import { MENU_ITEM_CLASS } from "@/components/features/compensations/menu-styles";
import { officialsSummary } from "@/components/features/games/officials-summary";
import { PrepareMatchItem } from "@/components/features/games/prepare-match-item";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { completeGamePath, gamePath, preparationPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate, formatMatchDay } from "@/lib/format";
import { itineraryUrl } from "@/lib/itinerary";
import { withTeams } from "@/lib/match-teams";
import { toParisTimeOfDay } from "@/lib/paris-time";
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
  /** « Préparer le match » dans le menu (§15.4.10). */
  prepareAction: PrepareAction;
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

function UpcomingMatchCard({ match, today, prepareAction }: CardProps) {
  const address = addressLabel(match.address);
  const date = formatIsoDate(toParisIsoDate(match.startsAt));
  const officials = officialsSummary(match.officials);
  const note = relativeLabel(today, match.startsAt);
  return (
    // `pr-14` : place pour la bulle « ⋯ » du coin.
    <article className="relative flex flex-col gap-1 rounded-md border border-border p-4 pt-5 pr-14">
      {/* Légende sur la bordure haute ; le fond de la page masque le trait derrière elle. */}
      <h3 className="absolute -top-3 left-3 bg-background px-1.5 leading-6 font-semibold whitespace-nowrap tabular-nums">
        {formatMatchDay(match.startsAt)}
      </h3>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="text-muted-foreground tabular-nums">
          {toParisTimeOfDay(match.startsAt)}
        </span>
        {note !== null && <span className="font-medium">{note}</span>}
      </p>
      <div className="flex min-w-0 items-center gap-3">
        <MatchClubBadges team1={match.team1Club} team2={match.team2Club} />
        <p className="min-w-0 font-medium break-words">
          {withTeams(t.teams, match.team1Name, match.team2Name)}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{matchLevelLabel(match.division)}</p>
      {officials !== null && (
        <p className="text-sm break-words">{t.officials.replace("{officials}", officials)}</p>
      )}
      {match.hasPreparation && <p className="text-sm font-medium">{fr.preparations.done}</p>}

      <ActionsMenu
        ariaLabel={fr.compensations.list.moreActionsLabel.replace("{date}", date)}
        corner
      >
        {isCompleteAddress(match.address) && (
          <a
            href={itineraryUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            data-close-menu
            aria-label={t.itineraryLabel.replace("{address}", address)}
            className={MENU_ITEM_CLASS}
          >
            {t.itinerary}
          </a>
        )}
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
        <PreparationMenuItem match={match} date={date} prepareAction={prepareAction} />
        <Link
          href={`/indemnites/${match.id}/modifier`}
          data-close-menu
          aria-label={t.editLabel.replace("{date}", date)}
          className={MENU_ITEM_CLASS}
        >
          {t.edit}
        </Link>
      </ActionsMenu>
    </article>
  );
}

type Props = {
  matches: readonly UpcomingMatch[];
  /** Jour de Paris (`AAAA-MM-JJ`), pour « Demain », « Dans 5 jours ». */
  today: string;
  /** « Préparer le match » (§15.4.10) dans le menu. */
  prepareAction: PrepareAction;
};

export function UpcomingMatchList({ matches, today, prepareAction }: Props) {
  return (
    // Écart et marge haute : la date déborde au-dessus de chaque carte.
    <ul className="flex flex-col gap-6 pt-3">
      {matches.map((match) => (
        <li key={match.id}>
          <UpcomingMatchCard match={match} today={today} prepareAction={prepareAction} />
        </li>
      ))}
    </ul>
  );
}
