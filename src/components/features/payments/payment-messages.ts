/**
 * Messages de la validation des paiements. Purs et sans React.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import { formatCents, formatIsoDate } from "@/lib/format";
import type { PaymentIssue } from "@/lib/schemas/payments";
import type { MarkPaidState } from "@/server/compensation/payments";

const t = fr.payments;

const ISSUES: Record<PaymentIssue, string> = {
  no_selection: t.errors.noSelection,
  too_many: t.errors.tooMany,
  invalid_selection: t.errors.invalidSelection,
  invalid_date: t.errors.invalidDate,
  future_date: t.errors.futureDate,
};

export function paymentIssueMessages(issues: readonly PaymentIssue[]): string[] {
  return issues.map((issue) => ISSUES[issue]);
}

/** Message global après l'envoi (les erreurs détaillées sont affichées à part). */
export function markPaidMessage(state: MarkPaidState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
    case "invalid":
      return null;
    case "unchanged":
      return { tone: "error", text: t.unchanged };
    case "marked": {
      const date = formatIsoDate(state.paidOn);
      return {
        tone: "success",
        text:
          state.count === 1
            ? t.markedOne.replace("{date}", date)
            : t.markedMany.replace("{count}", String(state.count)).replace("{date}", date),
      };
    }
  }
}

/** Résumé de la sélection en cours, ex. « 2 indemnités sélectionnées : 87,10 € ». */
export function selectionLabel(count: number, totalCents: number): string {
  if (count === 0) {
    return t.selectionNone;
  }
  const total = formatCents(totalCents);
  return count === 1
    ? t.selectionOne.replace("{total}", total)
    : t.selectionMany.replace("{count}", String(count)).replace("{total}", total);
}
