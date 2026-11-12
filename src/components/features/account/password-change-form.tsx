"use client";

/**
 * « Changer mon mot de passe » (page « Paramètres »). Replié par défaut : le formulaire
 * n'apparaît qu'après un clic. Il exige le mot de passe actuel, puis le nouveau (deux fois).
 * En cas de succès, l'appareil courant reste connecté : on affiche un message, sans redirection.
 */
import { useActionState, useId } from "react";
import { Disclosure } from "@/components/features/common/disclosure";
import { FIELD_CLASS, FormMessage, SUBMIT_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { ChangePasswordState } from "@/app/(app)/parametres/password-actions";
import { changePasswordMessage } from "./password-change-messages";

const t = fr.changePassword;

type Props = {
  action: (previous: ChangePasswordState, formData: FormData) => Promise<ChangePasswordState>;
};

export function PasswordChangeForm({ action }: Props) {
  const id = useId();
  const [state, formAction, isPending] = useActionState<ChangePasswordState, FormData>(action, {
    status: "idle",
  });
  const message = changePasswordMessage(state);
  const currentError = state.status === "invalid" || state.status === "wrong_password";
  const newError = state.status === "invalid_password" || state.status === "same_password";
  const confirmationError = state.status === "mismatch";

  return (
    <Disclosure summary={t.open} open={state.status !== "idle"}>
      <div className="flex flex-col gap-4">
        <FormMessage message={message} />
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-current`} className="text-sm font-medium">
              {t.currentPassword}
            </label>
            <input
              id={`${id}-current`}
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={currentError}
              aria-describedby={`${id}-current-hint`}
              className={`${FIELD_CLASS} sm:max-w-md`}
            />
            <p id={`${id}-current-hint`} className="text-sm text-muted-foreground">
              {t.currentPasswordHint}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-new`} className="text-sm font-medium">
              {t.newPassword}
            </label>
            <input
              id={`${id}-new`}
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
              aria-invalid={newError}
              aria-describedby={`${id}-new-hint`}
              className={`${FIELD_CLASS} sm:max-w-md`}
            />
            <p id={`${id}-new-hint`} className="text-sm text-muted-foreground">
              {t.newPasswordHint}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-confirmation`} className="text-sm font-medium">
              {t.confirmation}
            </label>
            <input
              id={`${id}-confirmation`}
              name="confirmation"
              type="password"
              required
              autoComplete="new-password"
              aria-invalid={confirmationError}
              className={`${FIELD_CLASS} sm:max-w-md`}
            />
          </div>

          <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
            {isPending ? t.submitting : t.submit}
          </button>
        </form>
      </div>
    </Disclosure>
  );
}
