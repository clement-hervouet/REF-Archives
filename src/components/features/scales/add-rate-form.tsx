"use client";

import { useId } from "react";
import { fr } from "@/i18n/fr";
import type { AddRateState } from "@/server/scales/manage-scales";
import { FormMessage, SUBMIT_BUTTON_CLASS } from "./form-parts";
import { RateFields } from "./rate-fields";
import { scaleStatusMessage } from "./scale-messages";
import { useScaleForm } from "./use-scale-form";

const t = fr.scales;

type Props = {
  scaleId: string;
  action: (previous: AddRateState, formData: FormData) => Promise<AddRateState>;
};

/** Ajout d'une ligne datée (montant de match + taux km) à un barème. */
export function AddRateForm({ scaleId, action }: Props) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["added"],
  );
  const invalid = state.status === "invalid" ? state.fields : [];

  return (
    <div className="flex flex-col gap-3">
      <FormMessage
        message={scaleStatusMessage(state.status, { invalidFields: invalid, limit: "rate" })}
      />
      <form key={formKey} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="scaleId" value={scaleId} />
        <RateFields idBase={id} valueOf={valueOf} invalid={invalid} />
        <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
          {isPending ? t.addRate.submitting : t.addRate.submit}
        </button>
      </form>
    </div>
  );
}
