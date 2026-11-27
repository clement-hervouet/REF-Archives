/**
 * Matchs à venir (page « À venir », blocs 7 et 10) : quand (avec « Demain », « Dans 5
 * jours »), qui, niveau, lieu, officiels du match complet. « Itinéraire » reste visible
 * quand l'adresse est complète (rue, code postal, ville : une adresse de club peut n'avoir
 * que son code postal, §15.4.1) ; agenda, match, préparation et modification sont dans le
 * menu « ⋯ ». Aussi utilisée pour les matchs de la semaine de l'accueil (bloc 13), en plus
 * court : la date en légende sur la bordure (pas de colonne), sans adresse (sous le niveau,
 * place aux collègues), menu en bulle dans le coin, « Itinéraire » dedans, et sans « Ajouter
 * à l'agenda » (l'abonnement s'en charge). Ni montant ni barème : c'est une fiche pratique
 * pour se rendre au match.
 */
import { MatchClubBadges } from "@/components/features/clubs/club-badge";
import { withTeams } from "@/lib/match-teams";
import { cn } from "@/lib/utils";
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
import { formatIsoDate, formatMatchDay } from "@/lib/format";
import { toParisTimeOfDay } from "@/lib/paris-time";
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

/** `home` : version courte de l'accueil (bloc 13), voir l'en-tête du fichier. */
type Variant = "upcoming" | "home";

type CardProps = {
  match: UpcomingMatch;
  today: string;
  variant: Variant;
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

function UpcomingMatchCard({ match, today, variant, prepareAction }: CardProps) {
  const address = addressLabel(match.address);
  const date = formatIsoDate(toParisIsoDate(match.startsAt));
  const officials = officialsSummary(match.officials);
  const withItinerary = isCompleteAddress(match.address);
  const isHome = variant === "home";
  const note = relativeLabel(today, match.startsAt);
  const teams = withTeams(t.teams, match.team1Name, match.team2Name);
  const menu = (
    <ActionsMenu
      ariaLabel={fr.compensations.list.moreActionsLabel.replace("{date}", date)}
      corner={isHome}
    >
      {isHome && withItinerary && (
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
      {!isHome && (
        // `<a>` et non `<Link>` : c'est un fichier à télécharger, pas une page.
        <a
          href={matchExportPath(match.id)}
          download
          data-close-menu
          aria-label={fr.calendar.export.ariaLabel.replace("{date}", date)}
          className={MENU_ITEM_CLASS}
        >
          {fr.calendar.export.label}
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
  );
  return (
    <article
      className={cn(
        "relative grid gap-x-5 gap-y-3 rounded-md border border-border p-4",
        // Accueil : pas de colonne d'actions, mais de la place pour la bulle « ⋯ » du coin.
        isHome ? "pt-5 pr-14" : "md:grid-cols-[5.5rem_minmax(0,1fr)_auto]",
      )}
    >
      {isHome ? (
        // Accueil : la date est posée sur la bordure haute, comme la légende d'un `<fieldset>`
        // (le fond de la page masque le trait derrière elle).
        <h3 className="absolute -top-3 left-3 bg-background px-1.5 leading-6 font-semibold whitespace-nowrap tabular-nums">
          {formatMatchDay(match.startsAt)}
        </h3>
      ) : (
        <MatchDate startsAt={match.startsAt} note={note} />
      )}

      <div className="flex min-w-0 flex-col gap-1">
        {isHome && (
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {toParisTimeOfDay(match.startsAt)}
            </span>
            {note !== null && <span className="font-medium">{note}</span>}
          </p>
        )}
        <div className="flex items-center gap-3">
          <MatchClubBadges team1={match.team1Club} team2={match.team2Club} />
          {isHome ? (
            <p className="min-w-0 font-medium break-words">{teams}</p>
          ) : (
            <h3 className="min-w-0 font-semibold break-words">{teams}</h3>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{matchLevelLabel(match.division)}</p>
        {!isHome && <p className="text-sm break-words">{address}</p>}
        {officials !== null && (
          <p className="text-sm break-words">{t.officials.replace("{officials}", officials)}</p>
        )}
        {match.hasPreparation && <p className="text-sm font-medium">{fr.preparations.done}</p>}
      </div>

      {isHome ? (
        menu
      ) : (
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
          {menu}
        </div>
      )}
    </article>
  );
}

type Props = {
  matches: readonly UpcomingMatch[];
  /** Jour de Paris (`AAAA-MM-JJ`), pour « Demain », « Dans 5 jours ». */
  today: string;
  /** `home` : version courte de l'accueil ; `upcoming` par défaut. */
  variant?: Variant;
  /** « Préparer le match » (§15.4.10) dans le menu. */
  prepareAction?: PrepareAction;
};

export function UpcomingMatchList({ matches, today, variant = "upcoming", prepareAction }: Props) {
  return (
    // Accueil : plus d'écart, pour la date qui déborde au-dessus de chaque carte.
    <ul className={cn("flex flex-col", variant === "home" ? "gap-6 pt-3" : "gap-3")}>
      {matches.map((match) => (
        <li key={match.id}>
          <UpcomingMatchCard
            match={match}
            today={today}
            variant={variant}
            prepareAction={prepareAction}
          />
        </li>
      ))}
    </ul>
  );
}
