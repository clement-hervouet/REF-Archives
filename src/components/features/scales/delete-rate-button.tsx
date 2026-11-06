"use client";

import { Trash2 } from "lucide-react";
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
 * Suppression d'une ligne : une icône discrète (bloc 10), nommée par la date de la ligne
 * pour les lecteurs d'écran et au survol. Le serveur décide (ligne utilisée, dernière ligne) : le
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
        title={t.deleteRate.label.replace("{date}", dateLabel)}
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-60"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
      {message !== null && (
        <p role="alert" className="max-w-56 text-right text-sm font-medium text-destructive">
          {message.text}
        </p>
      )}
    </form>
  );
}
