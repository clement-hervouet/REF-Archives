/**
 * Nom et prénom du titulaire du compte (bloc 10, §3.12). Obligatoires tous les deux.
 * Les messages sont des codes (`firstname.required`…) traduits à l'affichage.
 */
import { z } from "zod";
import { PERSON_NAME_MAX } from "@/lib/game-form-fields";

export { PERSON_NAME_MAX };

/** Aucun caractère de contrôle (sauts de ligne, tabulations, NUL…). */
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;

function nameSchema(field: "firstname" | "lastname") {
  // NFC : « é » saisi en un ou deux caractères donne la même chaîne en base.
  return z
    .string({ error: `${field}.required` })
    .transform((value) => value.normalize("NFC").trim())
    .pipe(
      z
        .string()
        .min(1, { error: `${field}.required` })
        .max(PERSON_NAME_MAX, { error: `${field}.too_long` })
        .regex(NO_CONTROL_CHARS, { error: `${field}.invalid` }),
    );
}

export const profileSchema = z.object({
  firstname: nameSchema("firstname"),
  lastname: nameSchema("lastname"),
});

export type Profile = z.infer<typeof profileSchema>;

/** Codes d'erreur possibles, à traduire dans `src/i18n/fr.ts`. */
export type ProfileIssue =
  | "firstname.required"
  | "firstname.too_long"
  | "firstname.invalid"
  | "lastname.required"
  | "lastname.too_long"
  | "lastname.invalid";

const PROFILE_ISSUES: readonly string[] = [
  "firstname.required",
  "firstname.too_long",
  "firstname.invalid",
  "lastname.required",
  "lastname.too_long",
  "lastname.invalid",
] satisfies readonly ProfileIssue[];

function isProfileIssue(code: string): code is ProfileIssue {
  return PROFILE_ISSUES.includes(code);
}

export type ProfileParseResult =
  { success: true; profile: Profile } | { success: false; issues: ProfileIssue[] };

/**
 * Valide le nom et le prénom (venus d'un formulaire ou d'ailleurs). Renvoie au plus une
 * erreur par champ, sans doublon, dans l'ordre prénom puis nom.
 */
export function parseProfile(input: { firstname: unknown; lastname: unknown }): ProfileParseResult {
  const parsed = profileSchema.safeParse(input);
  if (parsed.success) {
    return { success: true, profile: parsed.data };
  }
  const issues: ProfileIssue[] = [];
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (isProfileIssue(issue.message) && !issues.some((known) => known.split(".")[0] === field)) {
      issues.push(issue.message);
    }
  }
  return { success: false, issues };
}

/** Lit le nom et le prénom d'un formulaire (champs `firstname` et `lastname`). */
export function parseProfileForm(formData: FormData): ProfileParseResult {
  return parseProfile({
    firstname: formData.get("firstname"),
    lastname: formData.get("lastname"),
  });
}
