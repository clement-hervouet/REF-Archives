"use client";

/**
 * Formulaire « nom et prénom » : page « Compléter mon profil » (qui redirige vers l'accueil
 * après l'enregistrement) et section « Mon compte » des paramètres.
 */
import { useId } from "react";
import { FormMessage, PRIMARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import type { ProfileState } from "@/server/account/profile";
import { ProfileFields } from "./profile-fields";
import { profileStateMessage } from "./profile-messages";

type Props = {
  /** Valeurs enregistrées (chaînes vides pour un profil incomplet). */
  profile: { firstname: string; lastname: string };
  action: (previous: ProfileState, formData: FormData) => Promise<ProfileState>;
  submitLabel: string;
  submittingLabel: string;
};

export function ProfileForm({ profile, action, submitLabel, submittingLabel }: Props) {
  const id = useId();
  // Après un succès, le formulaire est remonté sur les valeurs de la base (props
  // rafraîchies) ; après une erreur, il garde la saisie.
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["saved"],
  );
  const defaults =
    state.status === "invalid"
      ? { firstname: valueOf("firstname"), lastname: valueOf("lastname") }
      : profile;

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={profileStateMessage(state)} />
      <form key={formKey} action={formAction} className="flex flex-col gap-4">
        <ProfileFields
          idPrefix={id}
          defaults={defaults}
          issues={state.status === "invalid" ? state.issues : []}
        />
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? submittingLabel : submitLabel}
        </button>
      </form>
    </div>
  );
}
