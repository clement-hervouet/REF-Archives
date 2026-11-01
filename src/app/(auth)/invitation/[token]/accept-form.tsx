"use client";

import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import { acceptInvitationAction } from "./actions";
import type { AcceptFormState } from "./actions";

const t = fr.invitation;
const FIELD_CLASS = "min-h-11 w-full rounded-md border border-neutral-400 px-3 py-2";

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
    case "invalid_password":
      return state.issues.map((code) => PASSWORD_MESSAGES[code] ?? fr.validation.passwordInvalid);
    case "rate_limited":
      return [fr.auth.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes))];
    case "idle":
      return [];
  }
}

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(acceptInvitationAction, {
    status: "idle",
  });
  const messages = errorMessages(state);
  const describedBy = messages.length > 0 ? "accept-errors accept-hint" : "accept-hint";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p>{t.intro.replace("{email}", email)}</p>
      {messages.length > 0 && (
        <div id="accept-errors" role="alert" className="flex flex-col gap-1">
          {messages.map((message) => (
            <p key={message} className="text-sm font-medium text-red-700">
              {message}
            </p>
          ))}
        </div>
      )}
      <input type="hidden" name="token" value={token} />
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
        <p id="accept-hint" className="text-sm text-neutral-700">
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
        className="min-h-11 rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? t.submitting : t.submit}
      </button>
    </form>
  );
}