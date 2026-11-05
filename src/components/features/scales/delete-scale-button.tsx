"use client";

import { useActionState, useState } from "react";
import { fr } from "@/i18n/fr";
import type { DeleteScaleState } from "@/server/scales/manage-scales";
import { SECONDARY_BUTTON_CLASS } from "./form-parts";
import { scaleStatusMessage } from "./scale-messages";

const t = fr.scales;

type Props = {
  scaleId: string;
  action: (previous: DeleteScaleState, formData: FormData) => Promise<DeleteScaleState>;
};

/** Suppression en deux temps : un premier clic demande une confirmation explicite. */
export function DeleteScaleButton({ scaleId, action }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<DeleteScaleState, FormData>(action, {
    status: "idle",
  });
  const message = scaleStatusMessage(state.status);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        {message !== null && message.tone === "error" && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
          className={`${SECONDARY_BUTTON_CLASS} self-start`}
        >
          {t.deleteScale.submit}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-red-700 p-3">
      <input type="hidden" name="scaleId" value={scaleId} />
      <p className="text-sm">{t.deleteScale.warning}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-md bg-red-700 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {t.deleteScale.confirm}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
          }}
          className={SECONDARY_BUTTON_CLASS}
        >
          {t.deleteScale.cancel}
        </button>
      </div>
    </form>
  );
}
