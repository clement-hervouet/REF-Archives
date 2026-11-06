/**
 * Résumé « À rembourser » de l'accueil (bloc 10) : total dû pour les matchs déjà joués,
 * leur nombre et le plus ancien en attente, avec un lien vers la validation des paiements.
 */
import Link from "next/link";
import { SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { UNPAID_PATH } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatCents, formatIsoDate } from "@/lib/format";
import type { UnpaidSummary } from "@/server/compensation/payments";
import type { UnpaidCompensation } from "@/server/db/payments";

const t = fr.home.unpaid;

export function UnpaidSummaryCard({ summary }: { summary: UnpaidSummary<UnpaidCompensation> }) {
  return (
    <section
      aria-labelledby="home-unpaid"
      className="flex flex-col gap-3 rounded-md border border-border p-4"
    >
      <h2 id="home-unpaid" className="text-xl font-semibold">
        {t.title}
      </h2>
      {summary.oldest === null ? (
        <p className="text-muted-foreground">{t.none}</p>
      ) : (
        <>
          <p className="text-3xl font-semibold tabular-nums [font-stretch:85%]">
            {formatCents(summary.totalCents)}
          </p>
          <p>
            {summary.count === 1
              ? t.countOne
              : t.countMany.replace("{count}", String(summary.count))}
          </p>
          <p className="text-sm break-words text-muted-foreground">
            {t.oldest
              .replace("{date}", formatIsoDate(toParisIsoDate(summary.oldest.startsAt)))
              .replace(
                "{teams}",
                fr.compensations.list.teams
                  .replace("{team1}", summary.oldest.team1Name)
                  .replace("{team2}", summary.oldest.team2Name),
              )}
          </p>
          <Link
            href={UNPAID_PATH}
            className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center self-start`}
          >
            {t.action}
          </Link>
        </>
      )}
    </section>
  );
}
