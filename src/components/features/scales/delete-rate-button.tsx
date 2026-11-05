"use client";

import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import type { DeleteRateState } from "@/server/scales/manage-scales";
import { scaleStatusMessage } from "./scale-messages";

const t = fr.scales;

type Props = {
  rateId: string;
  /** Date déjà formatée, pour un libellé accessible explicite. */
  dateLabel: string;
  action: (previous: DeleteRateState, formData: FormData) => Promise<DeleteRateState>;
};

/**
 * Suppression d'une ligne. Le serveur décide (ligne utilisée, dernière ligne) : le
 * bouton n'est qu'un confort, jamais une protection.
 */
export function DeleteRateButton({ rateId, dateLabel, action }: Props) {
  const [state, formAction, isPending] = useActionState<DeleteRateState, FormData>(action, {
    status: "idle",
  });
  const message = state.status === "deleted" ? null : scaleStatusMessage(state.status);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="rateId" value={rateId} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={t.deleteRate.label.replace("{date}", dateLabel)}
        className="min-h-11 rounded-md border border-neutral-400 px-3 disabled:opacity-60"
      >
        {t.deleteRate.submit}
      </button>
      {message !== null && (
        <p role="alert" className="max-w-56 text-right text-sm font-medium text-red-700">
          {message.text}
        </p>
      )}
    </form>
  );
}
