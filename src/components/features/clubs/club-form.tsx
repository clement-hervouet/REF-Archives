"use client";

/**
 * Fiche d'un club (§15.4.1) : nom et code postal obligatoires, rue, numéro, ville et pays
 * facultatifs. Sert à l'ajout (formulaire vidé après succès) et à la modification dans la
 * carte du club (champ caché `clubId`, vérifié côté serveur ; `onSuccess` referme la carte).
 * Grille en requêtes de conteneur : elle suit la largeur de la carte, pas celle de l'écran.
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
import type { ClubField } from "@/lib/schemas/clubs";
import type { ClubFormState } from "@/server/clubs/manage-clubs";
import { clubFieldError, clubStatusMessage } from "./club-messages";

const t = fr.clubs;

type Props = {
  action: (previous: ClubFormState, formData: FormData) => Promise<ClubFormState>;
  /** Modification : valeurs de départ, dont `clubId`. Sans elles : ajout. */
  initialValues?: Readonly<Record<string, string>>;
  labels: { submit: string; submitting: string; ariaLabel?: string };
  onSuccess?: () => void;
  onCancel?: () => void;
};

const MAX_LENGTHS: Record<ClubField, number> = {
  name: 255,
  street: 255,
  number: 20,
  postalCode: 10,
  city: 255,
  country: 100,
};

const REQUIRED: readonly ClubField[] = ["name", "postalCode"];

export function ClubForm({ action, initialValues, labels, onSuccess, onCancel }: Props) {
  const id = useId();
  const editing = initialValues !== undefined;
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    editing ? [] : ["created"],
    initialValues,
  );

  useEffect(() => {
    if (state.status === "updated") {
      onSuccess?.();
    }
  }, [state, onSuccess]);

  const field = (name: ClubField) => (
    <TextField
      id={`${id}-${name}`}
      name={name}
      label={t.fields[name]}
      maxLength={MAX_LENGTHS[name]}
      required={REQUIRED.includes(name)}
      defaultValue={valueOf(name)}
      error={clubFieldError(name, state)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {/* En modification, la carte annonce elle-même le succès en se refermant. */}
      {!(editing && state.status === "updated") && (
        <FormMessage message={clubStatusMessage(state)} />
      )}
      <form
        key={formKey}
        action={formAction}
        aria-label={labels.ariaLabel}
        className="@container flex max-w-3xl flex-col gap-3"
      >
        {editing && <input type="hidden" name="clubId" value={valueOf("clubId")} />}
        <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_8rem]">
          {field("name")}
          {field("postalCode")}
        </div>
        <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_8rem]">
          {field("street")}
          {field("number")}
        </div>
        <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
          {field("city")}
          {field("country")}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={isPending} className={PRIMARY_BUTTON_CLASS}>
            {isPending ? labels.submitting : labels.submit}
          </button>
          {onCancel !== undefined && (
            <button type="button" onClick={onCancel} className={SECONDARY_BUTTON_CLASS}>
              {t.edit.cancel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
