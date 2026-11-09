"use client";

/**
 * Fiche d'un collègue (blocs 9 et 10) : nom, prénom facultatif, club facultatif (existant
 * ou créé à la volée) et case
 * « a un compte ». Sert à l'ajout (formulaire vidé après succès, sur une ligne) et à la
 * modification dans la carte du collègue (champ caché `personId`, vérifié côté serveur ;
 * `onSuccess` referme la carte).
 */
import { useEffect, useId } from "react";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { PERSON_NAME_MAX } from "@/lib/game-form-fields";
import { cn } from "@/lib/utils";
import type { ColleagueFormState } from "@/server/games/colleagues-form";
import { ColleagueClubField } from "./colleague-club-field";
import type { ClubOption } from "./colleague-club-field";
import { colleagueStatusMessage } from "./game-messages";

const t = fr.games.officials;
const c = fr.colleagues;

export type { ClubOption };

type Props = {
  action: (previous: ColleagueFormState, formData: FormData) => Promise<ColleagueFormState>;
  clubs: readonly ClubOption[];
  /** Modification : valeurs de départ, dont `personId`. Sans elles : ajout. */
  initialValues?: Readonly<Record<string, string>>;
  labels: { submit: string; submitting: string; ariaLabel?: string };
  /** `stacked` : champs empilés, pour une carte étroite. */
  layout?: "inline" | "stacked";
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ColleagueForm({
  action,
  clubs,
  initialValues,
  labels,
  layout = "inline",
  onSuccess,
  onCancel,
}: Props) {
  const id = useId();
  const editing = initialValues !== undefined;
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    editing ? [] : ["created"],
    initialValues,
  );
  const inline = layout === "inline";

  useEffect(() => {
    if (state.status === "updated") {
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <div className="flex flex-col gap-3">
      {/* En modification, la carte annonce elle-même le succès en se refermant. */}
      {!(editing && state.status === "updated") && (
        <FormMessage message={colleagueStatusMessage(state)} />
      )}
      <form
        key={formKey}
        action={formAction}
        aria-label={labels.ariaLabel}
        className={cn("flex flex-col gap-3", inline && "md:flex-row md:flex-wrap md:items-end")}
      >
        {editing && <input type="hidden" name="personId" value={valueOf("personId")} />}
        <div className={cn(inline && "md:w-52")}>
          <TextField
            id={`${id}-lastname`}
            name="lastname"
            label={t.lastname}
            maxLength={PERSON_NAME_MAX}
            defaultValue={valueOf("lastname")}
            error={null}
          />
        </div>
        <div className={cn(inline && "md:w-52")}>
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
        <ColleagueClubField
          idBase={id}
          clubs={clubs}
          valueOf={valueOf}
          state={state}
          inline={inline}
        />
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="hasAccount"
            defaultChecked={valueOf("hasAccount") === "on"}
            className="h-5 w-5 shrink-0"
          />
          <span>{t.hasAccount}</span>
        </label>
        <div className={cn("flex flex-wrap gap-2", inline && "md:self-end")}>
          <button
            type="submit"
            disabled={isPending}
            className={editing ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
          >
            {isPending ? labels.submitting : labels.submit}
          </button>
          {onCancel !== undefined && (
            <button type="button" onClick={onCancel} className={SECONDARY_BUTTON_CLASS}>
              {c.edit.cancel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
