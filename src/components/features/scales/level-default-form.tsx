"use client";

import { useActionState, useId } from "react";
import { fr } from "@/i18n/fr";
import type { LevelDefaultState } from "@/server/scales/manage-scales";
import { FIELD_CLASS, SECONDARY_BUTTON_CLASS } from "./form-parts";
import { scaleStatusMessage } from "./scale-messages";

const t = fr.scales;

type Props = {
  divisionId: string;
  divisionLabel: string;
  /** Barèmes personnels actifs de l'utilisateur. */
  scales: readonly { id: string; name: string }[];
  /** Barème choisi pour ce niveau, ou `""` pour le barème commun. */
  selectedScaleId: string;
  action: (previous: LevelDefaultState, formData: FormData) => Promise<LevelDefaultState>;
};

/**
 * Choix du barème par défaut d'un niveau. Un bouton explicite plutôt qu'un envoi au
 * changement : naviguer au clavier dans la liste ne doit rien enregistrer (§7.4).
 */
export function LevelDefaultForm({
  divisionId,
  divisionLabel,
  scales,
  selectedScaleId,
  action,
}: Props) {
  const id = useId();
  const [state, formAction, isPending] = useActionState<LevelDefaultState, FormData>(action, {
    status: "idle",
  });
  const message = scaleStatusMessage(state.status);

  return (
    <form
      action={formAction}
      className="grid gap-2 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto] md:items-center"
    >
      <input type="hidden" name="divisionId" value={divisionId} />
      <label htmlFor={id} className="text-sm font-medium">
        {divisionLabel}
      </label>
      <select
        id={id}
        name="scaleId"
        defaultValue={selectedScaleId}
        aria-label={t.defaults.label.replace("{division}", divisionLabel)}
        className={FIELD_CLASS}
      >
        <option value="">{t.defaults.common}</option>
        {scales.map((scale) => (
          <option key={scale.id} value={scale.id}>
            {scale.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className={SECONDARY_BUTTON_CLASS}>
          {isPending ? t.defaults.submitting : t.defaults.submit}
        </button>
        {message !== null && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={
              message.tone === "error"
                ? "text-sm font-medium text-red-700"
                : "text-sm font-medium text-green-800"
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
