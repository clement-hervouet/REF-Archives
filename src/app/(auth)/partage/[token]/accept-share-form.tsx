"use client";

/**
 * Acceptation d'un lien de partage : explication, ajout facultatif du propriétaire à ses
 * collègues, bouton « Accepter ». Une acceptation réussie redirige vers la préparation.
 */
import { useActionState, useId } from "react";
import { FIELD_CLASS, SUBMIT_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { acceptShareAction } from "./actions";
import type { AcceptShareFormState } from "./actions";

const t = fr.sharing.accept;

function errorMessage(state: AcceptShareFormState): string | null {
  switch (state.status) {
    case "idle":
      return null;
    case "invalid":
      return t.invalid;
    case "own_link":
      return t.own;
    case "taken":
      return t.errors.taken;
    case "rate_limited":
      return t.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes));
  }
}

type Props = {
  token: string;
  ownerName: string;
  /** Fiches collègues proposées pour le propriétaire ; `null` : rien à proposer (déjà lié). */
  colleagues: readonly { id: string; name: string }[] | null;
  /** Choix proposé d'office : une fiche au même nom, sinon « create ». */
  defaultReverse: string;
};

export function AcceptShareForm({ token, ownerName, colleagues, defaultReverse }: Props) {
  const id = useId();
  const [state, formAction, isPending] = useActionState(acceptShareAction, { status: "idle" });
  const message = errorMessage(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {message !== null && (
        <p
          role="alert"
          className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
        >
          {message}
        </p>
      )}
      <p className="text-sm">{t.explain.replaceAll("{name}", ownerName)}</p>
      {colleagues !== null && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-reverse`} className="text-sm font-medium">
            {t.reverseLabel.replace("{name}", ownerName)}
          </label>
          <select
            id={`${id}-reverse`}
            name="reverse"
            defaultValue={defaultReverse}
            aria-describedby={`${id}-reverse-hint`}
            className={FIELD_CLASS}
          >
            <option value="create">{t.reverseCreate.replace("{name}", ownerName)}</option>
            {colleagues.map((colleague) => (
              <option key={colleague.id} value={colleague.id}>
                {t.reverseExisting.replace("{name}", colleague.name)}
              </option>
            ))}
            <option value="none">{t.reverseNone}</option>
          </select>
          <p id={`${id}-reverse-hint`} className="text-sm text-muted-foreground">
            {t.reverseHint}
          </p>
        </div>
      )}
      <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
        {isPending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
