"use client";

/**
 * Formulaire public « Demander un accès » (§15.4.4) : prénom, nom, adresse email. Après
 * l'envoi, un seul message, identique quelle que soit l'adresse.
 */
import Link from "next/link";
import { useActionState, useId } from "react";
import { ProfileFields } from "@/components/features/account/profile-fields";
import { SUBMIT_BUTTON_CLASS, TextField } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { submitAccessRequestAction } from "./actions";
import type { AccessRequestFormState } from "./actions";

const t = fr.accessRequest;
const LINK_CLASS = "inline-flex min-h-11 items-center self-start text-sm underline";

function errorMessage(state: AccessRequestFormState): string | null {
  switch (state.status) {
    case "invalid":
      return t.errors.invalid;
    case "rate_limited":
      return t.errors.rateLimited.replace("{minutes}", String(state.retryAfterMinutes));
    case "idle":
    case "requested":
      return null;
  }
}

export function AccessRequestForm() {
  const idPrefix = useId();
  const [state, formAction, isPending] = useActionState(submitAccessRequestAction, {
    status: "idle",
    values: { email: "", firstname: "", lastname: "" },
  });
  const message = errorMessage(state);

  if (state.status === "requested") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status">{t.requested.replace("{email}", state.email)}</p>
        <p className="text-sm text-muted-foreground">{t.alreadyAccount}</p>
        <Link href="/login" className={LINK_CLASS}>
          {t.backToLogin}
        </Link>
      </div>
    );
  }

  const profileIssues = state.status === "invalid" ? state.profileIssues : [];
  const emailInvalid = state.status === "invalid" && state.emailInvalid;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {message !== null && (
        <p
          role="alert"
          className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
        >
          {message}
        </p>
      )}
      {/* Après une erreur, les champs reprennent les valeurs renvoyées par l'action. */}
      <ProfileFields
        idPrefix={idPrefix}
        defaults={{ firstname: state.values.firstname, lastname: state.values.lastname }}
        issues={profileIssues}
      />
      <TextField
        id={`${idPrefix}-email`}
        name="email"
        type="email"
        label={t.email}
        defaultValue={state.values.email}
        error={emailInvalid ? t.errors.invalidEmail : null}
        autoComplete="email"
      />
      <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
        {isPending ? t.submitting : t.submit}
      </button>
      <Link href="/login" className={LINK_CLASS}>
        {t.backToLogin}
      </Link>
    </form>
  );
}
