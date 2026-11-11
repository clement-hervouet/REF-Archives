/**
 * Indemnités d'un mois (blocs 6 et 10). Chaque carte : la date en colonne (comme une feuille
 * de match), le match, le détail du montant, l'état du paiement, « Modifier » et le menu
 * « Plus d'actions ». Une liste de cartes plutôt qu'un tableau : lisible à 375 px.
 */
import Link from "next/link";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { completeGamePath, gamePath, matchExportPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatRoundTripKm } from "@/lib/distance";
import { formatCents, formatIsoDate } from "@/lib/format";
import { payerLabel } from "@/lib/payers";
import { cn } from "@/lib/utils";
import type { CompensationAmount } from "@/server/compensation/amount";
import type { DeleteCompensationState } from "@/server/compensation/compensation-form";
import type { PaymentStatus } from "@/server/compensation/monthly-totals";
import type { ClearPaymentState } from "@/server/compensation/payments";
import type { CompensationListItem } from "@/server/db/compensations";
import { ActionsMenu } from "./actions-menu";
import { addressLabel } from "./address-label";
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
}: { item: CompensationWithAmount } & Omit<Props, "items">) {
  const date = formatIsoDate(toParisIsoDate(item.startsAt));
  return (
    <article className="relative grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <MatchDate startsAt={item.startsAt} />

      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold break-words">
          {t.teams.replace("{team1}", item.team1Name).replace("{team2}", item.team2Name)}
        </h3>
        <p className="text-sm break-words">
          {t.details
            .replace("{division}", divisionLabel(item.division))
            .replace("{address}", addressLabel(item.address))}
        </p>
        <p className="text-sm font-medium">{t.payer.replace("{payer}", payerLabel(item.payer))}</p>
        <p className="text-sm break-words text-muted-foreground">
          {t.rateDetails
            .replace("{scale}", item.scaleName)
            .replace("{game}", formatCents(item.amount.gameCents))
            .replace("{mileage}", formatCents(item.amount.mileageCents))
            .replace("{distance}", formatRoundTripKm(item.distanceM))}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:items-end">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-col md:items-end">
          <p className="text-xl font-semibold tabular-nums [font-stretch:85%]">
            <span className="sr-only">{t.total} : </span>
            {formatCents(item.amount.totalCents)}
          </p>
          <PaymentBadge item={item} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={`/indemnites/${item.id}/modifier`}
            aria-label={t.editLabel.replace("{date}", date)}
            className="inline-flex min-h-11 items-center rounded-md border border-input px-4"
          >
            {t.edit}
          </Link>
          <ActionsMenu ariaLabel={t.moreActionsLabel.replace("{date}", date)}>
            {/* `<a>` et non `<Link>` : c'est un fichier à télécharger, pas une page. */}
            <a
              href={matchExportPath(item.id)}
              download
              data-close-menu
              aria-label={fr.calendar.export.ariaLabel.replace("{date}", date)}
              className={MENU_ITEM_CLASS}
            >
              {fr.calendar.export.label}
            </a>
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
            {item.paidOn !== null && (
              <ClearPaymentItem
                compensationId={item.id}
                dateLabel={date}
                action={clearPaymentAction}
              />
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
        </div>
      </div>
    </article>
  );
}

export function CompensationList({ items, deleteAction, clearPaymentAction }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <CompensationCard
            item={item}
            deleteAction={deleteAction}
            clearPaymentAction={clearPaymentAction}
          />
        </li>
      ))}
    </ul>
  );
}
