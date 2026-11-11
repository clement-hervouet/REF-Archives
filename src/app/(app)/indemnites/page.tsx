import Link from "next/link";
import { CompensationList } from "@/components/features/compensations/compensation-list";
import { MonthHeader } from "@/components/features/compensations/month-header";
import { SeasonTable } from "@/components/features/compensations/season-table";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { PageTitle } from "@/components/features/common/page-title";
import { fr } from "@/i18n/fr";
import { UNPAID_PATH } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { currentParisMonth, formatMonth, isMonth, parisMonthRange } from "@/lib/months";
import { seasonOf } from "@/lib/seasons";
import { requireUserOrRedirect } from "@/server/auth/session";
import { computeCompensation } from "@/server/compensation/amount";
import {
  computeMonthlyTotals,
  computePayerTotals,
  paymentStatus,
  sumTotals,
} from "@/server/compensation/monthly-totals";
import { buildSeasonView } from "@/server/compensation/season-view";
import { listCompensationAmounts, listCompensationsInRange } from "@/server/db/compensations";
import { getDb } from "@/server/db/pool";
import { clearPaymentAction, deleteCompensationAction } from "./actions";

const t = fr.compensations;

/** Paramètre `?mois=` : une seule valeur `AAAA-MM`, sinon ignoré. */
function monthParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" && isMonth(value) ? value : null;
}

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type CompensationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * « Mes indemnités » (blocs 6 et 10) : un mois à la fois (‹ ›), son total et ce qui en est
 * payé, ses indemnités, puis le tableau de la saison (juillet à juin).
 */
export default async function CompensationsPage(props: CompensationsPageProps) {
  // Chaque page vérifie elle-même (§6.2) ; requêtes filtrées par l'utilisateur de la session.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const now = new Date();
  // Mois demandé, sinon le mois en cours.
  const month = monthParam((await props.searchParams).mois) ?? currentParisMonth(now);
  const { from, to } = parisMonthRange(month);

  const [amounts, rows] = await Promise.all([
    listCompensationAmounts(db, user.id),
    listCompensationsInRange(db, { userId: user.id, from, to }),
  ]);
  const dated = amounts.map((row) => ({
    startsAt: row.startsAt,
    amount: computeCompensation(row, row.distanceM),
    status: paymentStatus(row.startsAt, row.paidOn, now),
    payer: row.payer,
  }));
  const totals = computeMonthlyTotals(dated);
  const items = rows.map((row) => ({
    ...row,
    amount: computeCompensation(row, row.distanceM),
    status: paymentStatus(row.startsAt, row.paidOn, now),
  }));
  const monthTotal = totals.find((total) => total.month === month) ?? sumTotals(month, []);
  const pendingCount = totals.reduce((sum, total) => sum + total.pendingCount, 0);
  const season = buildSeasonView(totals, month);
  // Répartition par organisme qui verse (bloc 10) : celle de la saison, puis celle du mois.
  const seasonPayers = computePayerTotals(
    dated.filter((item) => seasonOf(toParisIsoDate(item.startsAt).slice(0, 7)) === season.season),
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-2xl flex-col gap-1">
          <PageTitle>{t.list.title}</PageTitle>
          <p className="text-muted-foreground">{t.list.intro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pendingCount > 0 && (
            <Link
              href={UNPAID_PATH}
              className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center`}
            >
              {t.list.unpaidLink.replace("{count}", String(pendingCount))}
            </Link>
          )}
          <Link
            href="/indemnites/nouvelle"
            className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center`}
          >
            {t.list.create}
          </Link>
        </div>
      </section>

      {totals.length === 0 ? (
        <p className="rounded-md border border-border p-4">{t.list.empty}</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <MonthHeader month={month} total={monthTotal} payers={computePayerTotals(items)} />
            {items.length === 0 ? (
              <p className="rounded-md border border-border p-4">
                {t.list.emptyMonth.replace("{month}", formatMonth(month))}
              </p>
            ) : (
              <CompensationList
                items={items}
                deleteAction={deleteCompensationAction}
                clearPaymentAction={clearPaymentAction}
              />
            )}
          </div>
          <SeasonTable
            season={season.season}
            months={season.months}
            seasonTotal={season.seasonTotal}
            selectedMonth={month}
            otherSeasons={season.otherSeasons}
            payers={seasonPayers}
          />
        </>
      )}
    </div>
  );
}
