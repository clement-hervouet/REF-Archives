/**
 * Récapitulatif en direct du formulaire d'indemnité (bloc 10) : le match, l'horaire,
 * l'organisme qui versera et le montant, recalculés à chaque saisie. Sans état.
 */
import { fr } from "@/i18n/fr";
import { formatRoundTripKm } from "@/lib/distance";
import { formatCents, formatIsoDate, formatWeekdayDateTime } from "@/lib/format";
import { payerLabel } from "@/lib/payers";
import { cn } from "@/lib/utils";
import type { CompensationPreview } from "@/server/compensation/preview";
import type { FormPreview } from "./preview-input";

const t = fr.compensations.recap;

function Row({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("break-words", muted ? "text-muted-foreground" : "font-medium")}>
        {value}
      </dd>
    </div>
  );
}

type Props = {
  input: FormPreview;
  preview: CompensationPreview;
  className?: string;
};

export function CompensationRecap({ input, preview, className }: Props) {
  const teams =
    input.team1Name !== null && input.team2Name !== null
      ? fr.compensations.list.teams
          .replace("{team1}", input.team1Name)
          .replace("{team2}", input.team2Name)
      : null;
  const payer =
    preview.payer.status === "pending"
      ? null
      : (preview.payer.automatic ? t.payerAuto : t.payerChosen).replace(
          "{payer}",
          payerLabel(preview.payer.payer),
        );
  const amount = preview.amount;

  return (
    <section
      aria-label={t.title}
      className={cn(
        "flex flex-col gap-4 rounded-md border border-border bg-muted/40 p-4",
        className,
      )}
    >
      <h2 className="font-semibold">{t.title}</h2>
      <dl className="flex flex-col gap-3">
        <Row label={t.match} value={teams ?? t.teamsMissing} muted={teams === null} />
        <Row
          label={t.when}
          value={
            preview.startsAt === null ? t.whenMissing : formatWeekdayDateTime(preview.startsAt)
          }
          muted={preview.startsAt === null}
        />
        <Row label={t.payer} value={payer ?? t.payerPending} muted={payer === null} />
      </dl>
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">{t.amount}</p>
        {amount.status === "ok" ? (
          <>
            <p className="text-3xl font-semibold tabular-nums [font-stretch:85%]">
              {formatCents(amount.amount.totalCents)}
            </p>
            <p className="text-sm">
              {t.detail
                .replace("{game}", formatCents(amount.amount.gameCents))
                .replace("{mileage}", formatCents(amount.amount.mileageCents))
                .replace("{distance}", formatRoundTripKm(amount.distanceM))}
            </p>
            {input.scaleName !== null && (
              <p className="text-sm text-muted-foreground">
                {t.rateLine
                  .replace("{scale}", input.scaleName)
                  .replace("{date}", formatIsoDate(amount.effectiveFrom))}
              </p>
            )}
          </>
        ) : amount.status === "no_rate" ? (
          <p className="border-l-4 border-warning pl-3 text-sm">{t.noRate}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t.incomplete}</p>
        )}
      </div>
    </section>
  );
}
