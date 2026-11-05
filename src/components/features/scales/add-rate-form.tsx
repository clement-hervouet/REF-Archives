"use client";

import { useId } from "react";
import { fr } from "@/i18n/fr";
import type { AddRateState } from "@/server/scales/manage-scales";
import { FormMessage, SECONDARY_BUTTON_CLASS, TextField } from "./form-parts";
import { fieldError, scaleStatusMessage } from "./scale-messages";
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
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            id={`${id}-from`}
            name="effectiveFrom"
            type="date"
            label={t.fields.effectiveFrom}
            defaultValue={valueOf("effectiveFrom")}
            error={fieldError("effectiveFrom", invalid)}
          />
          <TextField
            id={`${id}-amount`}
            name="gameAmount"
            inputMode="decimal"
            label={t.fields.gameAmount}
            hint={t.fields.gameAmountHint}
            defaultValue={valueOf("gameAmount")}
            error={fieldError("gameAmount", invalid)}
          />
          <TextField
            id={`${id}-rate`}
            name="ratePerKm"
            inputMode="decimal"
            label={t.fields.ratePerKm}
            hint={t.fields.ratePerKmHint}
            defaultValue={valueOf("ratePerKm")}
            error={fieldError("ratePerKm", invalid)}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className={`${SECONDARY_BUTTON_CLASS} self-start`}
        >
          {isPending ? t.addRate.submitting : t.addRate.submit}
        </button>
      </form>
    </div>
  );
}
