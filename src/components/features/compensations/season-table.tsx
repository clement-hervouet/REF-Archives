/**
 * Tableau de la saison (bloc 10, juillet à juin) : une ligne par mois qui a des indemnités,
 * dans l'ordre de la saison, total en pied, état de paiement en toutes lettres. Chaque mois
 * mène à sa liste (`?mois=AAAA-MM`). Sur téléphone, seules les colonnes mois, matchs, total
 * et paiement restent : le détail match / kilométrage est dans chaque indemnité.
 */
import Link from "next/link";
import { fr } from "@/i18n/fr";
import { formatCents } from "@/lib/format";
import { formatMonth, formatShortMonth } from "@/lib/months";
import { seasonLabel } from "@/lib/seasons";
import { cn } from "@/lib/utils";
import type { MonthlyTotal, PayerTotal } from "@/server/compensation/monthly-totals";
import { PayerTable } from "./payer-table";
import { monthPaymentLabel } from "./season-labels";

const t = fr.compensations.season;

const CELL = "px-3 py-2 text-right tabular-nums";
const DETAIL_CELL = `${CELL} hidden md:table-cell`;

type Props = {
  season: number;
  /** Mois de la saison, dans l'ordre chronologique. */
  months: readonly MonthlyTotal[];
  seasonTotal: MonthlyTotal;
  selectedMonth: string;
  /** Autres saisons qui ont des indemnités : année de début et mois à ouvrir. */
  otherSeasons: readonly { season: number; month: string }[];
  /** Répartition de la saison par organisme qui verse (bloc 10). */
  payers: readonly PayerTotal[];
};

export function SeasonTable({
  season,
  months,
  seasonTotal,
  selectedMonth,
  otherSeasons,
  payers,
}: Props) {
  const label = seasonLabel(season);
  return (
    <section aria-labelledby="season-title" className="flex flex-col gap-3">
      <h2 id="season-title" className="text-xl font-semibold">
        {t.title.replace("{season}", label)}
      </h2>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t.caption.replace("{season}", label)}</caption>
          <thead className="bg-muted">
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
              <th scope="col" className="px-3 py-2 text-left">
                {t.payment}
              </th>
            </tr>
          </thead>
          <tbody>
            {months.map((total) => {
              const monthLabel = formatMonth(total.month);
              const selected = total.month === selectedMonth;
              return (
                <tr
                  key={total.month}
                  className={cn("border-t border-border", selected && "bg-accent font-semibold")}
                >
                  <th scope="row" className="px-3 py-1 text-left font-normal">
                    <Link
                      href={`/indemnites?mois=${total.month}`}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "inline-flex min-h-11 items-center underline first-letter:uppercase",
                        selected && "font-semibold",
                      )}
                    >
                      <span className="hidden md:inline">{monthLabel}</span>
                      <span className="md:hidden">{formatShortMonth(total.month)}</span>
                    </Link>
                    {selected && <span className="sr-only"> ({t.displayed})</span>}
                  </th>
                  <td className={CELL}>{total.gameCount}</td>
                  <td className={DETAIL_CELL}>{formatCents(total.gameCents)}</td>
                  <td className={DETAIL_CELL}>{formatCents(total.mileageCents)}</td>
                  <td className={cn(CELL, "font-semibold")}>{formatCents(total.totalCents)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{monthPaymentLabel(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <th scope="row" className="px-3 py-3 text-left">
                {t.seasonTotal}
              </th>
              <td className={CELL}>{seasonTotal.gameCount}</td>
              <td className={DETAIL_CELL}>{formatCents(seasonTotal.gameCents)}</td>
              <td className={DETAIL_CELL}>{formatCents(seasonTotal.mileageCents)}</td>
              <td className={CELL}>{formatCents(seasonTotal.totalCents)}</td>
              <td className="px-3 py-2 font-normal whitespace-nowrap">
                {monthPaymentLabel(seasonTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {payers.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          <h3 className="text-lg font-semibold">{fr.compensations.payers.title}</h3>
          <PayerTable
            totals={payers}
            caption={fr.compensations.payers.caption.replace("{season}", label)}
          />
        </div>
      )}
      {otherSeasons.length > 0 && (
        <nav aria-label={t.others} className="flex flex-wrap items-center gap-x-3 text-sm">
          <span className="text-muted-foreground">{t.others} :</span>
          {otherSeasons.map((other) => (
            <Link
              key={other.season}
              href={`/indemnites?mois=${other.month}`}
              className="inline-flex min-h-11 items-center underline"
            >
              {seasonLabel(other.season)}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
