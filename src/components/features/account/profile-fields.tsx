/**
 * Champs « Prénom » et « Nom », partagés par l'acceptation d'une invitation, la page
 * « Compléter mon profil » et la section « Mon compte ». Sans état.
 */
import { TextField } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { PERSON_NAME_MAX } from "@/lib/game-form-fields";
import type { ProfileIssue } from "@/lib/schemas/profile";
import { profileFieldError } from "./profile-messages";

type Props = {
  /** Préfixe des `id` HTML (issu de `useId`), pour pouvoir afficher deux formulaires. */
  idPrefix: string;
  defaults: { firstname: string; lastname: string };
  issues: readonly ProfileIssue[];
};

export function ProfileFields({ idPrefix, defaults, issues }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id={`${idPrefix}-firstname`}
        name="firstname"
        label={fr.profile.firstname}
        defaultValue={defaults.firstname}
        error={profileFieldError(issues, "firstname")}
        maxLength={PERSON_NAME_MAX}
        autoComplete="given-name"
      />
      <TextField
        id={`${idPrefix}-lastname`}
        name="lastname"
        label={fr.profile.lastname}
        defaultValue={defaults.lastname}
        error={profileFieldError(issues, "lastname")}
        maxLength={PERSON_NAME_MAX}
        autoComplete="family-name"
      />
    </div>
  );
}
