"use client";

/**
 * État du paiement d'une indemnité dans la liste mensuelle (bloc 10) : « Payée le… » avec
 * « Annuler le paiement » (erreur de saisie), « En attente de paiement » pour un match joué,
 * rien pour un match à venir. L'état est écrit en toutes lettres : jamais la couleur seule.
 */
import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import { formatIsoDate } from "@/lib/format";
import type { ClearPaymentState } from "@/server/compensation/payments";

const t = fr.compensations.list;

type Props = {
  compensationId: string;
  /** Jour du paiement `AAAA-MM-JJ`, ou `null`. */
  paidOn: string | null;
  /** Le match a déjà commencé : une indemnité non payée est alors en attente. */
  played: boolean;
  dateLabel: string;
  clearAction: (previous: ClearPaymentState, formData: FormData) => Promise<ClearPaymentState>;
};

export function PaymentStatus({ compensationId, paidOn, played, dateLabel, clearAction }: Props) {
  const [state, formAction, isPending] = useActionState<ClearPaymentState, FormData>(clearAction, {
    status: "idle",
  });

  if (paidOn === null) {
    return (
      <>
        {state.status === "cleared" && (
          <p role="status" className="text-sm text-muted-foreground">
            {t.paymentCleared}
          </p>
        )}
        {played && (
          <p className="self-start rounded-sm border border-warning px-2 py-0.5 text-sm md:self-end">
            {t.pending}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1 md:items-end">
      <p className="self-start rounded-sm border border-success px-2 py-0.5 text-sm font-medium md:self-end">
        {t.paidOn.replace("{date}", formatIsoDate(paidOn))}
      </p>
      {state.status === "not_found" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t.paymentNotFound}
        </p>
      )}
      <form action={formAction}>
        <input type="hidden" name="compensationId" value={compensationId} />
        <button
          type="submit"
          disabled={isPending}
          aria-label={t.clearPaymentLabel.replace("{date}", dateLabel)}
          className="inline-flex min-h-11 items-center text-sm underline disabled:opacity-60"
        >
          {t.clearPayment}
        </button>
      </form>
    </div>
  );
}
