"use client";

import { useActionState } from "react";
import { fr } from "@/i18n/fr";
import { login } from "./actions";
import type { LoginFormState } from "./actions";

function errorMessage(state: LoginFormState): string | null {
  switch (state.status) {
    case "invalid":
      return fr.auth.errors.invalidCredentials;
    case "rate_limited":
      return fr.auth.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes));
    case "error":
      return fr.auth.errors.unexpected;
    case "idle":
      return null;
  }
}

const FIELD_CLASS = "min-h-11 w-full rounded-md border border-neutral-400 px-3 py-2";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, { status: "idle", email: "" });
  const message = errorMessage(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {message !== null && (
        <p id="login-error" role="alert" className="text-sm font-medium text-red-700">
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
        className="min-h-11 rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {isPending ? fr.auth.login.submitting : fr.auth.login.submit}
      </button>
    </form>
  );
}