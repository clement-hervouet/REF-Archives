"use client";

/**
 * Axes d'amélioration : un texte libre par axe, dans l'ordre choisi par l'utilisateur. Tout
 * est facultatif ; un champ vidé est effacé à l'enregistrement.
 *
 * Les éditeurs sont indexés par axe : quand l'ordre change, ils se déplacent avec leur
 * saisie en cours, sans être recréés.
 */
import { useId } from "react";
import { RichTextField } from "@/components/features/common/rich-text-field";
import { FormMessage, SUBMIT_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { IMPROVEMENT_TEXT_MAX } from "@/lib/improvement-axes-fields";
import type { ImprovementAxesFormState } from "@/server/improvement/manage-improvement-axes";
import type { AxisLabel } from "./improvement-axes-manager";

const t = fr.improvementAxes;

type Props = {
  action: (
    previous: ImprovementAxesFormState,
    formData: FormData,
  ) => Promise<ImprovementAxesFormState>;
  /** Les axes, dans l'ordre d'affichage. */
  axes: readonly AxisLabel[];
  /** Textes enregistrés (ou vides), par axe, relus après chaque enregistrement. */
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

export function ImprovementAxesForm({ action, axes, initialValues }: Props) {
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
      {/* Une case par ligne, sur toute la largeur ; chacune grandit avec son texte. */}
      <div className="flex flex-col gap-4">
        {axes.map(({ slot, label }) => {
          const error = state.status === "invalid" && state.fields.includes(slot);
          return (
            <RichTextField
              key={slot}
              id={`${id}-${slot}`}
              name={slot}
              label={label}
              labelClassName="font-medium"
              defaultValue={current(slot)}
              maxLength={IMPROVEMENT_TEXT_MAX}
              error={error ? t.errors.text : null}
              height="xs"
            />
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
