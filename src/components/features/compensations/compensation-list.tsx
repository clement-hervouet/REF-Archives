/**
 * Indemnités d'un mois (blocs 6 et 10). Chaque carte : la date en colonne (comme une feuille
 * de match), le match et son niveau (sans adresse), le payeur, le montant, l'état du paiement
 * et le menu « ⋯ » en bulle dans le coin (« Modifier » en tête ; pas « Ajouter à l'agenda »,
 * l'abonnement s'en charge). Une liste de cartes plutôt qu'un tableau : lisible à 375 px.
 */
import { withTeams } from "@/lib/match-teams";
import Link from "next/link";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { completeGamePath, gamePath, preparationPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatCents, formatIsoDate } from "@/lib/format";
import { payerLabel } from "@/lib/payers";
import { cn } from "@/lib/utils";
import type { CompensationAmount } from "@/server/compensation/amount";
import type { DeleteCompensationState } from "@/server/compensation/compensation-form";
import type { PaymentStatus } from "@/server/compensation/monthly-totals";
import type { ClearPaymentState } from "@/server/compensation/payments";
import type { PrepareMatchState } from "@/server/games/preparation-form";
import { MatchClubBadges } from "@/components/features/clubs/club-badge";
import { PrepareMatchItem } from "@/components/features/games/prepare-match-item";
import type { CompensationListItem } from "@/server/db/compensations";
import { ActionsMenu } from "./actions-menu";
import { ClearPaymentItem } from "./clear-payment-item";
import { DeleteCompensationButton } from "./delete-compensation-button";
import { MatchDate } from "./match-date";
import { MENU_ITEM_CLASS } from "./menu-styles";

const t = fr.compensations.list;

type CompensationWithAmount = CompensationListItem & {
  amount: CompensationAmount;
  status: PaymentStatus;
};

type Props = {
  items: readonly CompensationWithAmount[];
  deleteAction: (
    previous: DeleteCompensationState,
    formData: FormData,
  ) => Promise<DeleteCompensationState>;
  clearPaymentAction: (
    previous: ClearPaymentState,
    formData: FormData,
  ) => Promise<ClearPaymentState>;
  /** « Préparer le match » (§15.4.10) : crée le match complet si besoin. */
  prepareAction: (previous: PrepareMatchState, formData: FormData) => Promise<PrepareMatchState>;
};

/** État du paiement en toutes lettres ; rien pour un match à venir (pas encore dû). */
function PaymentBadge({ item }: { item: CompensationWithAmount }) {
  if (item.status === "upcoming") {
    return null;
  }
  return item.paidOn !== null ? (
    <p className="rounded-sm border border-success px-2 py-0.5 text-sm font-medium">
      {t.paidOn.replace("{date}", formatIsoDate(item.paidOn))}
    </p>
  ) : (
    <p className="rounded-sm border border-warning px-2 py-0.5 text-sm">{t.pending}</p>
  );
}

function CompensationCard({
  item,
  deleteAction,
  clearPaymentAction,
  prepareAction,
}: { item: CompensationWithAmount } & Omit<Props, "items">) {
  const date = formatIsoDate(toParisIsoDate(item.startsAt));
  return (
    // `pr-14` : place pour la bulle « ⋯ » du coin.
    <article className="relative grid gap-x-5 gap-y-3 rounded-md border border-border p-4 pr-14 md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <MatchDate startsAt={item.startsAt} />

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-3">
          <MatchClubBadges team1={item.team1Club} team2={item.team2Club} />
          <h3 className="min-w-0 font-semibold break-words">
            {withTeams(t.teams, item.team1Name, item.team2Name)}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">{matchLevelLabel(item.division)}</p>
        <p className="text-sm font-medium">{t.payer.replace("{payer}", payerLabel(item.payer))}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-col md:items-end">
        <p className="text-xl font-semibold tabular-nums [font-stretch:85%]">
          <span className="sr-only">{t.total} : </span>
          {formatCents(item.amount.totalCents)}
        </p>
        <PaymentBadge item={item} />
      </div>

      <ActionsMenu ariaLabel={t.moreActionsLabel.replace("{date}", date)} corner>
        <Link
          href={`/indemnites/${item.id}/modifier`}
          data-close-menu
          aria-label={t.editLabel.replace("{date}", date)}
          className={MENU_ITEM_CLASS}
        >
          {t.edit}
        </Link>
        {item.gameId === null ? (
          <Link
            href={completeGamePath(item.id)}
            data-close-menu
            aria-label={fr.games.completeMatchLabel.replace("{date}", date)}
            className={MENU_ITEM_CLASS}
          >
            {fr.games.completeMatch}
          </Link>
        ) : (
          <Link
            href={gamePath(item.gameId)}
            data-close-menu
            aria-label={fr.games.viewMatchLabel.replace("{date}", date)}
            className={MENU_ITEM_CLASS}
          >
            {fr.games.viewMatch}
          </Link>
        )}
        {/* Pas de préparation pour un plateau (§15.4.10). */}
        {item.team2Name !== null &&
          (item.gameId === null ? (
            <PrepareMatchItem compensationId={item.id} dateLabel={date} action={prepareAction} />
          ) : (
            <Link
              href={preparationPath(item.gameId)}
              data-close-menu
              aria-label={fr.preparations.openMenuLabel.replace("{date}", date)}
              className={MENU_ITEM_CLASS}
            >
              {fr.preparations.open}
            </Link>
          ))}
        {item.paidOn !== null && (
          <ClearPaymentItem compensationId={item.id} dateLabel={date} action={clearPaymentAction} />
        )}
        <div className="mt-0.5 border-t border-border pt-0.5">
          <DeleteCompensationButton
            compensationId={item.id}
            dateLabel={date}
            action={deleteAction}
            triggerClassName={cn(MENU_ITEM_CLASS, "text-destructive")}
          />
        </div>
      </ActionsMenu>
    </article>
  );
}

export function CompensationList({
  items,
  deleteAction,
  clearPaymentAction,
  prepareAction,
}: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <CompensationCard
            item={item}
            deleteAction={deleteAction}
            clearPaymentAction={clearPaymentAction}
            prepareAction={prepareAction}
          />
        </li>
      ))}
    </ul>
  );
}
