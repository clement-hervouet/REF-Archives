/**
 * Totaux des indemnités par mois. Chaque mois mène à la liste de ses indemnités
 * (`?mois=AAAA-MM`). Sur mobile, seules les colonnes mois, matchs et total restent : le
 * détail match / kilométrage est dans chaque indemnité.
 */
import Link from "next/link";
import { fr } from "@/i18n/fr";
import { formatCents } from "@/lib/format";
import { formatMonth } from "@/lib/months";
import type { MonthlyTotal } from "@/server/compensation/monthly-totals";

const t = fr.compensations.totals;

type Props = {
  totals: readonly MonthlyTotal[];
  /** Mois actuellement affiché en dessous. */
  selectedMonth: string;
};

const CELL = "px-3 py-2 text-right tabular-nums";
/** Colonne de détail, masquée sur petit écran. */
const DETAIL_CELL = `${CELL} hidden md:table-cell`;

export function MonthlyTotalsTable({ totals, selectedMonth }: Props) {
  return (
    <div className="overflow-x-auto rounded-md border border-neutral-300">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t.caption}</caption>
        <thead className="bg-neutral-100">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">
              {t.month}
            </th>
            <th scope="col" className={CELL}>
              {t.count}
            </th>
            <th scope="col" className={DETAIL_CELL}>
              {t.game}
            </th>
            <th scope="col" className={DETAIL_CELL}>
              {t.mileage}
            </th>
            <th scope="col" className={CELL}>
              {t.total}
            </th>
          </tr>
        </thead>
        <tbody>
          {totals.map((total) => {
            const label = formatMonth(total.month);
            const selected = total.month === selectedMonth;
            return (
              <tr
                key={total.month}
                className={`border-t border-neutral-200 ${selected ? "bg-neutral-50 font-semibold" : ""}`}
              >
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <Link
                    href={`/indemnites?mois=${total.month}`}
                    aria-label={t.show.replace("{month}", label)}
                    aria-current={selected ? "true" : undefined}
                    className="inline-flex min-h-11 items-center underline"
                  >
                    {label}
                  </Link>
                  {selected && <span className="sr-only"> ({t.current})</span>}
                </th>
                <td className={CELL}>{total.gameCount}</td>
                <td className={DETAIL_CELL}>{formatCents(total.gameCents)}</td>
                <td className={DETAIL_CELL}>{formatCents(total.mileageCents)}</td>
                <td className={`${CELL} font-semibold`}>{formatCents(total.totalCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
