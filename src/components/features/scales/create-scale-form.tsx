"use client";

import { useId } from "react";
import { fr } from "@/i18n/fr";
import type { CreateScaleState } from "@/server/scales/manage-scales";
import { FormMessage, PRIMARY_BUTTON_CLASS, TextField } from "./form-parts";
import { fieldError, scaleStatusMessage } from "./scale-messages";
import { useScaleForm } from "./use-scale-form";

const t = fr.scales;

type Props = {
  action: (previous: CreateScaleState, formData: FormData) => Promise<CreateScaleState>;
};

/** Création d'un barème personnel avec sa première ligne (un barème n'est jamais vide). */
export function CreateScaleForm({ action }: Props) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["created"],
  );
  const invalid = state.status === "invalid" ? state.fields : [];

  return (
    <div className="flex flex-col gap-3">
      <FormMessage message={scaleStatusMessage(state.status, { invalidFields: invalid })} />
      <form key={formKey} action={formAction} className="flex flex-col gap-4">
        <TextField
          id={`${id}-name`}
          name="name"
          label={t.fields.name}
          maxLength={100}
          defaultValue={valueOf("name")}
          error={fieldError("name", invalid)}
        />
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
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? t.create.submitting : t.create.submit}
        </button>
      </form>
    </div>
  );
}
