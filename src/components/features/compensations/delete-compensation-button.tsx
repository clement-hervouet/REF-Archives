"use client";

import { useActionState, useState } from "react";
import {
  DESTRUCTIVE_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { DeleteCompensationState } from "@/server/compensation/compensation-form";

const t = fr.compensations;

type Props = {
  compensationId: string;
  /** Date lisible du match, pour l'étiquette accessible du bouton. */
  dateLabel: string;
  action: (
    previous: DeleteCompensationState,
    formData: FormData,
  ) => Promise<DeleteCompensationState>;
  /** Classe du premier bouton (ex. élément de menu) ; bouton secondaire par défaut. */
  triggerClassName?: string;
};

/** Suppression en deux temps : un premier clic demande une confirmation explicite. */
export function DeleteCompensationButton({
  compensationId,
  dateLabel,
  action,
  triggerClassName = SECONDARY_BUTTON_CLASS,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<DeleteCompensationState, FormData>(action, {
    status: "idle",
  });

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        {state.status === "not_found" && (
          <p
            role="alert"
            className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
          >
            {t.errors.compensationNotFound}
          </p>
        )}
        <button
          type="button"
          aria-label={t.delete.label.replace("{date}", dateLabel)}
          onClick={() => {
            setConfirming(true);
          }}
          className={triggerClassName}
        >
          {t.delete.submit}
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-destructive p-3"
    >
      <input type="hidden" name="compensationId" value={compensationId} />
      <p className="text-sm">{t.delete.warning}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className={DESTRUCTIVE_BUTTON_CLASS}>
          {t.delete.confirm}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
          }}
          className={SECONDARY_BUTTON_CLASS}
        >
          {t.delete.cancel}
        </button>
      </div>
    </form>
  );
}
