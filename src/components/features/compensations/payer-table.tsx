/**
 * Répartition par organisme qui verse (bloc 10) : « CD35 », « Ligue de Bretagne »,
 * « Fédération ». Mêmes colonnes que le tableau des mois (matchs, montant du match,
 * kilométrage, total, état du paiement en toutes lettres). Sur téléphone, l'état passe sous
 * le nom de l'organisme : la colonne ne tiendrait pas.
 */
import { fr } from "@/i18n/fr";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PayerTotal } from "@/server/compensation/monthly-totals";
import { monthPaymentLabel } from "./season-labels";

const t = fr.compensations;

const CELL = "px-3 py-2 text-right tabular-nums";
const DETAIL_CELL = `${CELL} hidden md:table-cell`;

type Props = {
  totals: readonly PayerTotal[];
  caption: string;
};

export function PayerTable({ totals, caption }: Props) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">
              {t.payers.payer}
            </th>
            <th scope="col" className={CELL}>
              {t.season.count}
            </th>
            <th scope="col" className={DETAIL_CELL}>
              {t.season.game}
            </th>
            <th scope="col" className={DETAIL_CELL}>
              {t.season.mileage}
            </th>
            <th scope="col" className={CELL}>
              {t.season.total}
            </th>
            <th scope="col" className="hidden px-3 py-2 text-left sm:table-cell">
              {t.season.payment}
            </th>
          </tr>
        </thead>
        <tbody>
          {totals.map((total) => (
            <tr key={total.key} className="border-t border-border">
              <th scope="row" className="px-3 py-3 text-left font-medium">
                {total.label}
                <span className="block text-sm font-normal text-muted-foreground sm:hidden">
                  {monthPaymentLabel(total)}
                </span>
              </th>
              <td className={CELL}>{total.gameCount}</td>
              <td className={DETAIL_CELL}>{formatCents(total.gameCents)}</td>
              <td className={DETAIL_CELL}>{formatCents(total.mileageCents)}</td>
              <td className={cn(CELL, "font-semibold")}>{formatCents(total.totalCents)}</td>
              <td className="hidden px-3 py-2 whitespace-nowrap sm:table-cell">
                {monthPaymentLabel(total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
