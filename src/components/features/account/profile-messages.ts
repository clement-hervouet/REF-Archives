/**
 * Messages du formulaire « nom et prénom ». Purs et sans React.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import type { ProfileIssue } from "@/lib/schemas/profile";
import type { ProfileState } from "@/server/account/profile";

const t = fr.profile;

const ISSUE_MESSAGES: Record<ProfileIssue, string> = {
  "firstname.required": t.errors.firstnameRequired,
  "firstname.too_long": t.errors.firstnameTooLong,
  "firstname.invalid": t.errors.firstnameInvalid,
  "lastname.required": t.errors.lastnameRequired,
  "lastname.too_long": t.errors.lastnameTooLong,
  "lastname.invalid": t.errors.lastnameInvalid,
};

/** Erreur à afficher sous le champ `field`, ou `null`. */
export function profileFieldError(
  issues: readonly ProfileIssue[],
  field: "firstname" | "lastname",
): string | null {
  const issue = issues.find((code) => code.startsWith(`${field}.`));
  return issue === undefined ? null : ISSUE_MESSAGES[issue];
}

/** Message global après l'envoi du formulaire, ou `null`. */
export function profileStateMessage(state: ProfileState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "saved":
      return { tone: "success", text: t.settings.saved };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "not_found":
      return { tone: "error", text: t.errors.notFound };
  }
}
