/**
 * Messages du formulaire « Changer mon mot de passe ». Purs et sans React.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import type { ChangePasswordState } from "@/app/(app)/parametres/password-actions";

const t = fr.changePassword;

/** Codes de `passwordSchema` (`password.too_short`…) traduits à l'affichage. */
const PASSWORD_ISSUE_MESSAGES: Record<string, string> = {
  "password.too_short": fr.validation.passwordTooShort,
  "password.too_long": fr.validation.passwordTooLong,
  "password.too_common": fr.validation.passwordTooCommon,
};

function passwordIssueMessage(issues: string[]): string {
  const first = issues[0];
  return (
    (first === undefined ? undefined : PASSWORD_ISSUE_MESSAGES[first]) ??
    fr.validation.passwordInvalid
  );
}

/** Message après l'envoi, ou `null` (état initial). Le succès reste affiché (pas de redirection). */
export function changePasswordMessage(state: ChangePasswordState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "changed":
      return { tone: "success", text: t.success };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "invalid_password":
      return { tone: "error", text: passwordIssueMessage(state.issues) };
    case "mismatch":
      return { tone: "error", text: t.errors.mismatch };
    case "wrong_password":
      return { tone: "error", text: t.errors.wrongPassword };
    case "same_password":
      return { tone: "error", text: t.errors.samePassword };
    case "rate_limited":
      return {
        tone: "error",
        text: t.errors.rateLimited.replace(
          "{minutes}",
          String(Math.max(1, Math.ceil(state.retryAfterSeconds / 60))),
        ),
      };
    case "not_found":
      return { tone: "error", text: t.errors.notFound };
  }
}
