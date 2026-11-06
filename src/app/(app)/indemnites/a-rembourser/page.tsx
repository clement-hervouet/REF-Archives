import Link from "next/link";
import { PaymentForm } from "@/components/features/payments/payment-form";
import type { PayableItem } from "@/components/features/payments/payment-form";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { formatCents, formatIsoDate } from "@/lib/format";
import { toParisTimeOfDay } from "@/lib/paris-time";
import { requireUserOrRedirect } from "@/server/auth/session";
import { computeCompensation } from "@/server/compensation/amount";
import { summarizeUnpaid } from "@/server/compensation/payments";
import { listUnpaidPlayedCompensations } from "@/server/db/payments";
import { getDb } from "@/server/db/pool";
import { markPaidAction } from "./actions";

const t = fr.payments;

/**
 * « À rembourser » (bloc 10) : matchs déjà joués dont l'indemnité n'est pas payée, à
 * valider par sélection libre. Un match à venir n'est pas encore dû : il n'apparaît pas ici.
 */
export default async function UnpaidCompensationsPage() {
  // Chaque page vérifie elle-même (§6.2) ; la requête est filtrée par l'utilisateur.
  const user = await requireUserOrRedirect();
  const now = new Date();
  const rows = await listUnpaidPlayedCompensations(getDb(), { userId: user.id, before: now });
  const summary = summarizeUnpaid(rows);
  const items: PayableItem[] = rows.map((row) => ({
    id: row.id,
    dateLabel: fr.compensations.list.matchOn
      .replace("{date}", formatIsoDate(toParisIsoDate(row.startsAt)))
      .replace("{time}", toParisTimeOfDay(row.startsAt)),
    teams: fr.compensations.list.teams
      .replace("{team1}", row.team1Name)
      .replace("{team2}", row.team2Name),
    details: divisionLabel(row.division),
    totalCents: computeCompensation(row, row.distanceM).totalCents,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/indemnites" className="inline-flex min-h-11 items-center self-start underline">
        {t.back}
      </Link>
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
        {summary.count > 0 && (
          <p className="font-medium tabular-nums">
            {t.pendingTotal.replace("{total}", formatCents(summary.totalCents))}
          </p>
        )}
      </section>
      {items.length === 0 ? (
        <p className="rounded-md border border-border p-4">{t.empty}</p>
      ) : (
        <PaymentForm items={items} today={toParisIsoDate(now)} action={markPaidAction} />
      )}
    </div>
  );
}
