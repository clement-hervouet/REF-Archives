/**
 * Résumé « À rembourser » de l'accueil (bloc 10) : total dû pour les matchs déjà joués,
 * leur nombre et le plus ancien en attente, avec un lien vers la validation des paiements.
 */
import Link from "next/link";
import { SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { UNPAID_PATH } from "@/lib/app-paths";
import { formatCents, formatMatchDay } from "@/lib/format";
import type { PayerGroup, UnpaidSummary } from "@/server/compensation/payments";
import type { UnpaidCompensation } from "@/server/db/payments";

const t = fr.home.unpaid;

/** Au-delà, les organismes restants sont résumés en une ligne. */
const MAX_PAYERS_SHOWN = 4;

type Props = {
  summary: UnpaidSummary<UnpaidCompensation>;
  /** Ce qui reste dû, par organisme qui verse (bloc 10). */
  byPayer: readonly PayerGroup<UnpaidCompensation>[];
};

export function UnpaidSummaryCard({ summary, byPayer }: Props) {
  const shown = byPayer.slice(0, MAX_PAYERS_SHOWN);
  const hidden = byPayer.length - shown.length;
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
          <ul className="flex flex-col gap-0.5 border-t border-border pt-2 text-sm">
            {shown.map((group) => (
              <li key={group.key} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{group.label}</span>
                <span className="font-medium tabular-nums">{formatCents(group.totalCents)}</span>
              </li>
            ))}
            {hidden > 0 && (
              <li className="text-muted-foreground">
                {t.byPayerMore.replace("{count}", String(hidden))}
              </li>
            )}
          </ul>
          <p className="text-sm break-words text-muted-foreground">
            {t.oldest
              .replace("{date}", formatMatchDay(summary.oldest.startsAt))
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
