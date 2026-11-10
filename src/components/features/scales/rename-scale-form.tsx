"use client";

import { useId } from "react";
import { fr } from "@/i18n/fr";
import type { RenameScaleState } from "@/server/scales/manage-scales";
import { FormMessage, PRIMARY_BUTTON_CLASS, TextField } from "./form-parts";
import { fieldError, scaleStatusMessage } from "./scale-messages";
import { useScaleForm } from "./use-scale-form";

const t = fr.scales;

type Props = {
  scaleId: string;
  currentName: string;
  action: (previous: RenameScaleState, formData: FormData) => Promise<RenameScaleState>;
};

export function RenameScaleForm({ scaleId, currentName, action }: Props) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["renamed"],
  );
  const invalid = state.status === "invalid" ? state.fields : [];
  // Après un succès, le champ reprend le nom actuel (déjà mis à jour par la page).
  const typed = valueOf("name");

  return (
    <div className="flex flex-col gap-3">
      <FormMessage message={scaleStatusMessage(state.status, { invalidFields: invalid })} />
      <form
        key={formKey}
        action={formAction}
        className="flex flex-col gap-3 md:flex-row md:items-end"
      >
        <input type="hidden" name="scaleId" value={scaleId} />
        <div className="md:flex-1">
          <TextField
            id={`${id}-name`}
            name="name"
            label={t.rename.label}
            maxLength={100}
            defaultValue={typed === "" ? currentName : typed}
            error={fieldError("name", invalid)}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className={`${PRIMARY_BUTTON_CLASS} w-full md:w-auto`}
        >
          {isPending ? t.rename.submitting : t.rename.submit}
        </button>
      </form>
    </div>
  );
}
