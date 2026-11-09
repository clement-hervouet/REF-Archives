"use client";

import { useId } from "react";
import { ProfileFields } from "@/components/features/account/profile-fields";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { acceptInvitationAction } from "./actions";
import type { AcceptFormState } from "./actions";

const t = fr.invitation;
const FIELD_CLASS = "min-h-11 w-full rounded-md border border-input px-3 py-2";

const PASSWORD_MESSAGES: Record<string, string> = {
  "password.too_short": fr.validation.passwordTooShort,
  "password.too_long": fr.validation.passwordTooLong,
  "password.too_common": fr.validation.passwordTooCommon,
};

function errorMessages(state: AcceptFormState): string[] {
  switch (state.status) {
    case "mismatch":
      return [t.errors.mismatch];
    case "invalid_invitation":
      return [t.invalid];
    case "invalid_profile":
      // Le détail est affiché sous chaque champ.
      return [fr.profile.errors.invalid];
    case "invalid_password":
      return state.issues.map((code) => PASSWORD_MESSAGES[code] ?? fr.validation.passwordInvalid);
    case "rate_limited":
      return [fr.auth.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes))];
    case "idle":
      return [];
  }
}

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const id = useId();
  // Aucun statut de succès : une acceptation réussie redirige. Après une erreur, le prénom
  // et le nom sont remis dans les champs ; les mots de passe, eux, sont toujours à ressaisir.
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    acceptInvitationAction,
    { status: "idle" },
    [],
  );
  const messages = errorMessages(state);
  const describedBy = messages.length > 0 ? "accept-errors accept-hint" : "accept-hint";

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      <p>{t.intro.replace("{email}", email)}</p>
      {messages.length > 0 && (
        <div id="accept-errors" role="alert" className="flex flex-col gap-1">
          {messages.map((message) => (
            <p
              key={message}
              className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
            >
              {message}
            </p>
          ))}
        </div>
      )}
      <input type="hidden" name="token" value={token} />
      <ProfileFields
        idPrefix={id}
        defaults={{ firstname: valueOf("firstname"), lastname: valueOf("lastname") }}
        issues={state.status === "invalid_profile" ? state.issues : []}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={describedBy}
          className={FIELD_CLASS}
        />
        <p id="accept-hint" className="text-sm text-muted-foreground">
          {t.passwordHint}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmation" className="text-sm font-medium">
          {t.confirmation}
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          className={FIELD_CLASS}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
