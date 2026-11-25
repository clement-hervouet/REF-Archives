"use client";

/**
 * Axes d'amélioration : un texte libre par axe (mécaniques AK, AT et transitions, prise de
 * décision, gestuelle, jugement des fautes et des violations). Tout est facultatif ; un
 * champ vidé est effacé à l'enregistrement.
 */
import { useId } from "react";
import {
  FIELD_CLASS,
  FormMessage,
  SUBMIT_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { IMPROVEMENT_AXES, IMPROVEMENT_TEXT_MAX } from "@/lib/improvement-axes-fields";
import type { ImprovementAxesFormState } from "@/server/improvement/improvement-axes-form";

const t = fr.improvementAxes;

type Props = {
  action: (
    previous: ImprovementAxesFormState,
    formData: FormData,
  ) => Promise<ImprovementAxesFormState>;
  /** Fiche enregistrée (ou champs vides), relue après chaque enregistrement. */
  initialValues: Readonly<Record<string, string>>;
};

function statusMessage(state: ImprovementAxesFormState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "saved":
      return { tone: "success", text: t.saved };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
  }
}

export function ImprovementAxesForm({ action, initialValues }: Props) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["saved"],
    initialValues,
  );
  // Après un succès, la saisie n'est pas conservée : on repart des valeurs enregistrées
  // (relues par la page). Après une erreur, on garde ce qui a été tapé.
  const current = (name: string): string =>
    state.status === "invalid" ? valueOf(name) : (initialValues[name] ?? "");

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {IMPROVEMENT_AXES.map((axis) => {
          const fieldId = `${id}-${axis}`;
          const error = state.status === "invalid" && state.fields.includes(axis);
          return (
            <div key={axis} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={fieldId} className="font-medium">
                {t.axes[axis]}
              </label>
              <textarea
                id={fieldId}
                name={axis}
                rows={5}
                maxLength={IMPROVEMENT_TEXT_MAX}
                defaultValue={current(axis)}
                aria-invalid={error}
                aria-describedby={`${fieldId}-hint${error ? ` ${fieldId}-error` : ""}`}
                className={FIELD_CLASS}
              />
              <p id={`${fieldId}-hint`} className="sr-only">
                {t.textHint}
              </p>
              {error && (
                <p id={`${fieldId}-error`} className="text-sm font-medium text-destructive">
                  {t.errors.text}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {/* Formulaire long : le résultat s'affiche près du bouton, là où l'on vient de cliquer. */}
      <FormMessage message={statusMessage(state)} />
      <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
        {isPending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
