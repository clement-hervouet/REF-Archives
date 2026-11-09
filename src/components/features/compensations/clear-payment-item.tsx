"use client";

/**
 * « Annuler le paiement » dans le menu d'une indemnité payée (bloc 10), pour corriger une
 * validation faite par erreur. Le serveur vérifie la propriété (§6.2).
 */
import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import type { ClearPaymentState } from "@/server/compensation/payments";
import { MENU_ITEM_CLASS } from "./menu-styles";

const t = fr.compensations.list;

type Props = {
  compensationId: string;
  dateLabel: string;
  action: (previous: ClearPaymentState, formData: FormData) => Promise<ClearPaymentState>;
};

export function ClearPaymentItem({ compensationId, dateLabel, action }: Props) {
  const [state, formAction, isPending] = useActionState<ClearPaymentState, FormData>(action, {
    status: "idle",
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="compensationId" value={compensationId} />
      {state.status === "not_found" && (
        <p role="alert" className="px-3 py-1 text-sm font-medium text-destructive">
          {t.paymentNotFound}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        aria-label={t.clearPaymentLabel.replace("{date}", dateLabel)}
        className={MENU_ITEM_CLASS}
      >
        {t.clearPayment}
      </button>
    </form>
  );
}
