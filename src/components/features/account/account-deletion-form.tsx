"use client";

/**
 * « Supprimer mon compte » (page « Paramètres », bloc 11). Replié par défaut : le
 * formulaire n'apparaît qu'après un clic, puis exige le mot de passe. En cas de succès,
 * l'action déconnecte et redirige vers la connexion ; une erreur garde le panneau ouvert.
 */
import { useActionState, useId } from "react";
import { Disclosure } from "@/components/features/common/disclosure";
import { FIELD_CLASS, FormMessage } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { AccountDeletionState } from "@/app/(app)/parametres/account-deletion-actions";
import { accountDeletionMessage } from "./account-deletion-messages";

const t = fr.myData.deletion;

type Props = {
  action: (previous: AccountDeletionState, formData: FormData) => Promise<AccountDeletionState>;
};

export function AccountDeletionForm({ action }: Props) {
  const id = useId();
  const [state, formAction, isPending] = useActionState<AccountDeletionState, FormData>(action, {
    status: "idle",
  });
  const passwordError = state.status === "invalid" || state.status === "wrong_password";

  return (
    <Disclosure summary={t.open} open={state.status !== "idle"}>
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t.warning}</p>
        <FormMessage message={accountDeletionMessage(state)} />
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-password`} className="text-sm font-medium">
              {t.password}
            </label>
            <input
              id={`${id}-password`}
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={passwordError}
              aria-describedby={`${id}-password-hint`}
              className={`${FIELD_CLASS} sm:max-w-md`}
            />
            <p id={`${id}-password-hint`} className="text-sm text-muted-foreground">
              {t.passwordHint}
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-11 self-start rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground disabled:opacity-60"
          >
            {isPending ? t.submitting : t.submit}
          </button>
        </form>
      </div>
    </Disclosure>
  );
}
