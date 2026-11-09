"use client";

/**
 * Informations d'un compte (bloc 10) : prénom, nom (mêmes règles que Paramètres), email de
 * connexion et rôle. Pour son propre compte, l'admin ne peut pas retirer ses droits : le
 * rôle est affiché mais figé.
 */
import { useId } from "react";
import { ProfileFields } from "@/components/features/account/profile-fields";
import {
  FIELD_CLASS,
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { ACCOUNT_ROLES } from "@/lib/schemas/accounts";
import { EMAIL_MAX_LENGTH } from "@/lib/schemas/auth";
import type { AccountRole } from "@/lib/schemas/accounts";
import type { ProfileIssue } from "@/lib/schemas/profile";
import type { AccountDetailsState } from "@/app/(app)/admin/comptes/actions";
import { detailsFieldError, detailsMessage } from "./account-messages";

const t = fr.admin.accounts.sections.details;

type Props = {
  action: (previous: AccountDetailsState, formData: FormData) => Promise<AccountDetailsState>;
  account: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    role: AccountRole;
  };
  isSelf: boolean;
};

export function AccountDetailsForm({ action, account, isSelf }: Props) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    // Après un succès, la page renvoie les valeurs enregistrées : on repart d'elles.
    ["updated"],
    {
      firstname: account.firstname,
      lastname: account.lastname,
      email: account.email,
      role: account.role,
    },
  );
  const issues = state.status === "invalid" ? state.issues : [];
  const profileIssues = issues.filter(
    (issue): issue is ProfileIssue =>
      issue.startsWith("firstname.") || issue.startsWith("lastname."),
  );
  const current = (name: string, saved: string) =>
    state.status === "updated" || state.status === "idle" ? saved : valueOf(name);
  const emailError = detailsFieldError(state, "email");
  const roleError = detailsFieldError(state, "role");

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={detailsMessage(state)} />
      <form key={formKey} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="accountId" value={account.id} />
        <ProfileFields
          idPrefix={`${id}-profile`}
          defaults={{
            firstname: current("firstname", account.firstname),
            lastname: current("lastname", account.lastname),
          }}
          issues={profileIssues}
        />
        <TextField
          id={`${id}-email`}
          name="email"
          type="email"
          label={fr.profile.settings.emailLabel}
          hint={t.emailHint}
          maxLength={EMAIL_MAX_LENGTH}
          defaultValue={current("email", account.email)}
          error={emailError}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-role`} className="text-sm font-medium">
            {t.role}
          </label>
          {isSelf && <input type="hidden" name="role" value="admin" />}
          <select
            id={`${id}-role`}
            name={isSelf ? undefined : "role"}
            defaultValue={current("role", account.role)}
            disabled={isSelf}
            aria-describedby={isSelf ? `${id}-role-hint` : undefined}
            aria-invalid={roleError !== null}
            className={`${FIELD_CLASS} sm:max-w-xs disabled:opacity-70`}
          >
            {ACCOUNT_ROLES.map((role) => (
              <option key={role} value={role}>
                {t.roles[role]}
              </option>
            ))}
          </select>
          {isSelf && (
            <p id={`${id}-role-hint`} className="text-sm text-muted-foreground">
              {t.selfRole}
            </p>
          )}
          {roleError !== null && (
            <p className="text-sm font-medium text-destructive">{roleError}</p>
          )}
        </div>
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
