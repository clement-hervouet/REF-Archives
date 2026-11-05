import Link from "next/link";
import { CompensationList } from "@/components/features/compensations/compensation-list";
import { MonthlyTotalsTable } from "@/components/features/compensations/monthly-totals-table";
import { PRIMARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { currentParisMonth, formatMonth, isMonth, parisMonthRange } from "@/lib/months";
import { requireUserOrRedirect } from "@/server/auth/session";
import { computeCompensation } from "@/server/compensation/amount";
import { computeMonthlyTotals } from "@/server/compensation/monthly-totals";
import { listCompensationAmounts, listCompensationsInRange } from "@/server/db/compensations";
import { getDb } from "@/server/db/pool";
import { deleteCompensationAction } from "./actions";

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

export default async function CompensationsPage(props: CompensationsPageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();

  const amounts = await listCompensationAmounts(db, user.id);
  const totals = computeMonthlyTotals(
    amounts.map((row) => ({
      startsAt: row.startsAt,
      amount: computeCompensation(row, row.distanceM),
    })),
  );
  // Mois demandé, sinon le plus récent qui a des indemnités, sinon le mois en cours.
  const month =
    monthParam((await props.searchParams).mois) ??
    totals[0]?.month ??
    currentParisMonth(new Date());
  const { from, to } = parisMonthRange(month);
  const items = (await listCompensationsInRange(db, { userId: user.id, from, to })).map((item) => ({
    ...item,
    amount: computeCompensation(item, item.distanceM),
  }));
  const monthLabel = formatMonth(month);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t.list.title}</h1>
          <p className="text-muted-foreground">{t.list.intro}</p>
        </div>
        <Link
          href="/indemnites/nouvelle"
          className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center self-start`}
        >
          {t.list.create}
        </Link>
      </section>

      {totals.length === 0 ? (
        <p>{t.list.empty}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t.totals.title}</h2>
            <MonthlyTotalsTable totals={totals} selectedMonth={month} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {t.list.monthTitle.replace("{month}", monthLabel)}
            </h2>
            {items.length === 0 ? (
              <p>{t.list.emptyMonth.replace("{month}", monthLabel)}</p>
            ) : (
              <CompensationList items={items} deleteAction={deleteCompensationAction} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
