"use client";

import { useId } from "react";
import { fr } from "@/i18n/fr";
import type { CreateScaleState } from "@/server/scales/manage-scales";
import { FormMessage, SUBMIT_BUTTON_CLASS, TextField } from "./form-parts";
import { RateFields } from "./rate-fields";
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
        <RateFields idBase={id} valueOf={valueOf} invalid={invalid} />
        <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
          {isPending ? t.create.submitting : t.create.submit}
        </button>
      </form>
    </div>
  );
}
