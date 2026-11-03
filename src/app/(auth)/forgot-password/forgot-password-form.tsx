"use client";

import Link from "next/link";
import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import { requestPasswordResetAction } from "./actions";
import type { ForgotPasswordFormState } from "./actions";

const t = fr.forgotPassword;
const FIELD_CLASS = "min-h-11 w-full rounded-md border border-neutral-400 px-3 py-2";
const LINK_CLASS = "inline-flex min-h-11 items-center self-start text-sm underline";

function errorMessage(state: ForgotPasswordFormState): string | null {
  switch (state.status) {
    case "invalid_email":
      return t.errors.invalidEmail;
    case "rate_limited":
      return t.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes));
    case "idle":
    case "requested":
      return null;
  }
}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, {
    status: "idle",
    email: "",
  });
  const message = errorMessage(state);

  if (state.status === "requested") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">
          {t.requested
            .replace("{email}", state.email)
            .replace("{minutes}", String(state.validityMinutes))}
        </p>
        <Link href="/login" className={LINK_CLASS}>
          {t.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-neutral-700">{t.intro}</p>
      {message !== null && (
        <p id="forgot-error" role="alert" className="text-sm font-medium text-red-700">
          {message}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="forgot-email" className="text-sm font-medium">
          {t.email}
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-describedby={message !== null ? "forgot-error" : undefined}
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
      <Link href="/login" className={LINK_CLASS}>
        {t.backToLogin}
      </Link>
    </form>
  );
}