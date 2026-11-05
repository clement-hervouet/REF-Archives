"use client";

/**
 * Fiche d'un collègue (bloc 9) : nom, prénom facultatif et case « a un compte ». Sert à
 * l'ajout (formulaire vidé après succès) et à la modification (champ caché `personId`,
 * vérifié côté serveur).
 */
import { useId } from "react";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { PERSON_NAME_MAX } from "@/lib/game-form-fields";
import type { ColleagueFormState } from "@/server/games/colleagues-form";
import { colleagueStatusMessage } from "./game-messages";

const t = fr.games.officials;

type Props = {
  action: (previous: ColleagueFormState, formData: FormData) => Promise<ColleagueFormState>;
  /** Modification : valeurs de départ, dont `personId`. Sans elles : ajout. */
  initialValues?: Readonly<Record<string, string>>;
  labels: { submit: string; submitting: string; ariaLabel?: string };
};

export function ColleagueForm({ action, initialValues, labels }: Props) {
  const id = useId();
  const editing = initialValues !== undefined;
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    editing ? [] : ["created"],
    initialValues,
  );

  return (
    <div className="flex flex-col gap-3">
      <FormMessage message={colleagueStatusMessage(state)} />
      <form
        key={formKey}
        action={formAction}
        aria-label={labels.ariaLabel}
        className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end"
      >
        {editing && <input type="hidden" name="personId" value={valueOf("personId")} />}
        <div className="md:w-56">
          <TextField
            id={`${id}-lastname`}
            name="lastname"
            label={t.lastname}
            maxLength={PERSON_NAME_MAX}
            defaultValue={valueOf("lastname")}
            error={null}
          />
        </div>
        <div className="md:w-56">
          <TextField
            id={`${id}-firstname`}
            name="firstname"
            label={t.firstname}
            maxLength={PERSON_NAME_MAX}
            required={false}
            defaultValue={valueOf("firstname")}
            error={null}
          />
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="hasAccount"
            defaultChecked={valueOf("hasAccount") === "on"}
            className="h-5 w-5 shrink-0"
          />
          <span>{t.hasAccount}</span>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className={`${editing ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS} self-start md:self-end`}
        >
          {isPending ? labels.submitting : labels.submit}
        </button>
      </form>
    </div>
  );
}
