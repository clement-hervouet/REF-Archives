"use client";

import Link from "next/link";
import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import { login } from "./actions";
import type { LoginFormState } from "./actions";

function errorMessage(state: LoginFormState): string | null {
  switch (state.status) {
    case "invalid":
      return fr.auth.errors.invalidCredentials;
    case "rate_limited":
      return fr.auth.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes));
    case "blocked":
      return state.until === null
        ? fr.auth.errors.blocked
        : fr.auth.errors.blockedUntil.replace("{date}", formatDateTime(new Date(state.until)));
    case "deletion_pending":
      return fr.auth.errors.deletionPending;
    case "error":
      return fr.auth.errors.unexpected;
    case "idle":
      return null;
  }
}

const FIELD_CLASS = "min-h-11 w-full rounded-md border border-input px-3 py-2";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, { status: "idle", email: "" });
  const message = errorMessage(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {message !== null && (
        <p
          id="login-error"
          role="alert"
          className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
        >
          {message}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          {fr.auth.login.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-describedby={message !== null ? "login-error" : undefined}
          className={FIELD_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          {fr.auth.login.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={message !== null ? "login-error" : undefined}
          className={FIELD_CLASS}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? fr.auth.login.submitting : fr.auth.login.submit}
      </button>
      <Link
        href="/forgot-password"
        className="inline-flex min-h-11 items-center self-start text-sm underline"
      >
        {fr.auth.login.forgotPassword}
      </Link>
    </form>
  );
}
