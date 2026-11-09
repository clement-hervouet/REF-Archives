"use client";

/**
 * Envoi d'un lien de réinitialisation du mot de passe (bloc 10). L'admin ne voit jamais le
 * lien : il part par email à la personne, valable 30 minutes.
 */
import { FormMessage, SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import type { PasswordLinkState } from "@/app/(app)/admin/comptes/actions";
import { passwordLinkMessage } from "./account-messages";

const t = fr.admin.accounts.sections.password;

type Props = {
  action: (previous: PasswordLinkState, formData: FormData) => Promise<PasswordLinkState>;
  accountId: string;
  disabled: boolean;
};

export function PasswordLinkForm({ action, accountId, disabled }: Props) {
  const [state, formAction, isPending] = useActionState<PasswordLinkState, FormData>(action, {
    status: "idle",
  });
  if (disabled) {
    return <p className="text-sm text-muted-foreground">{t.disabled}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <FormMessage message={passwordLinkMessage(state)} />
      <form action={formAction}>
        <input type="hidden" name="accountId" value={accountId} />
        <button type="submit" disabled={isPending} className={SECONDARY_BUTTON_CLASS}>
          {isPending ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
