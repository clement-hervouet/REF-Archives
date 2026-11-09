/**
 * En-tête du mois affiché (bloc 10) : mois précédent / suivant, total du mois, nombre de
 * matchs, et répartition payé / en attente / à venir.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { fr } from "@/i18n/fr";
import { formatCents } from "@/lib/format";
import { formatMonth, nextMonth, previousMonth } from "@/lib/months";
import type { MonthlyTotal, PayerTotal } from "@/server/compensation/monthly-totals";
import { matchCountLabel, monthPaymentLabel } from "./season-labels";

const t = fr.compensations.month;

const NAV_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-input hover:bg-accent";

function Figure({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{formatCents(cents)}</dd>
    </div>
  );
}

type Props = {
  month: string;
  total: MonthlyTotal;
  /** Répartition du mois par organisme qui verse (bloc 10). */
  payers: readonly PayerTotal[];
};

export function MonthHeader({ month, total, payers }: Props) {
  const previous = previousMonth(month);
  const next = nextMonth(month);
  return (
    <section aria-labelledby="month-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* Flèches : seules icônes de la page, pour un geste fréquent (changer de mois). */}
        <Link
          href={`/indemnites?mois=${previous}`}
          aria-label={`${t.previous} : ${formatMonth(previous)}`}
          className={NAV_CLASS}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <h2
          id="month-title"
          className="min-w-0 flex-1 text-center text-2xl font-semibold first-letter:uppercase md:flex-none md:text-left"
        >
          {formatMonth(month)}
        </h2>
        <Link
          href={`/indemnites?mois=${next}`}
          aria-label={`${t.next} : ${formatMonth(next)}`}
          className={NAV_CLASS}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-10">
        <p className="flex items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums [font-stretch:85%]">
            {formatCents(total.totalCents)}
          </span>
          <span className="text-muted-foreground">{matchCountLabel(total.gameCount)}</span>
        </p>
        {total.gameCount > 0 && (
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {/* « Payé » n'a de sens que si au moins un match du mois est déjà joué. */}
            {total.gameCount > total.upcomingCount && (
              <Figure label={t.paid} cents={total.paidCents} />
            )}
            {total.pendingCount > 0 && <Figure label={t.pending} cents={total.pendingCents} />}
            {total.upcomingCount > 0 && <Figure label={t.upcoming} cents={total.upcomingCents} />}
          </dl>
        )}
      </div>

      {payers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm text-muted-foreground">{fr.compensations.payers.monthTitle}</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {payers.map((payer) => (
              <li
                key={payer.key}
                className="flex items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block font-medium break-words">{payer.label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {monthPaymentLabel(payer)}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatCents(payer.totalCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
