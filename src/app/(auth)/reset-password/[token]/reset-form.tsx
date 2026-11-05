"use client";

import Link from "next/link";
import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import { resetPasswordAction } from "./actions";
import type { ResetPasswordFormState } from "./actions";

const t = fr.resetPassword;
const FIELD_CLASS = "min-h-11 w-full rounded-md border border-neutral-400 px-3 py-2";

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

function errorMessage(state: ResetPasswordFormState): string | null {
  switch (state.status) {
    case "invalid_link":
      return t.invalid;
    case "invalid_password":
      return passwordIssueMessage(state.issues);
    case "mismatch":
      return t.errors.mismatch;
    case "rate_limited":
      return t.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes));
    case "idle":
      return null;
  }
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, { status: "idle" });
  const message = errorMessage(state);
  const describedBy = message !== null ? "reset-error reset-password-hint" : "reset-password-hint";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-neutral-700">{t.intro}</p>
      {message !== null && (
        <p id="reset-error" role="alert" className="text-sm font-medium text-red-700">
          {message}
        </p>
      )}
      {state.status === "invalid_link" && (
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          {t.requestNew}
        </Link>
      )}
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="reset-password" className="text-sm font-medium">
          {t.password}
        </label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={describedBy}
          className={FIELD_CLASS}
        />
        <p id="reset-password-hint" className="text-sm text-neutral-700">
          {fr.invitation.passwordHint}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reset-confirmation" className="text-sm font-medium">
          {t.confirmation}
        </label>
        <input
          id="reset-confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={message !== null ? "reset-error" : undefined}
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
