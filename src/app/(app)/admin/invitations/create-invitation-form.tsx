"use client";

import { useActionState, useState } from "react";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import { createInvitationAction } from "./actions";
import type { CreateInvitationFormState } from "./actions";

const t = fr.admin.invitations;
const FIELD_CLASS = "min-h-11 w-full rounded-md border border-neutral-400 px-3 py-2";

function errorMessage(state: CreateInvitationFormState): string | null {
  switch (state.status) {
    case "invalid_email":
      return t.errors.invalidEmail;
    case "email_taken":
      return t.errors.emailTaken;
    case "idle":
    case "created":
      return null;
  }
}

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy(): void {
    // Si le presse-papiers est refusé, le champ reste sélectionnable à la main.
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
      },
      () => {
        setCopied(false);
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="invitation-link" className="text-sm font-medium">
        {t.linkLabel}
      </label>
      <input
        id="invitation-link"
        readOnly
        value={url}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        className={FIELD_CLASS}
      />
      <button
        type="button"
        onClick={copy}
        className="min-h-11 self-start rounded-md border border-neutral-400 px-4"
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}

export function CreateInvitationForm() {
  const [state, formAction, isPending] = useActionState(createInvitationAction, {
    status: "idle",
  });
  const message = errorMessage(state);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        {message !== null && (
          <p id="invitation-error" role="alert" className="text-sm font-medium text-red-700">
            {message}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="invitation-email" className="text-sm font-medium">
            {t.email}
          </label>
          <input
            id="invitation-email"
            name="email"
            type="email"
            autoComplete="off"
            required
            aria-describedby={message !== null ? "invitation-error" : undefined}
            className={FIELD_CLASS}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 self-start rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {isPending ? t.submitting : t.submit}
        </button>
      </form>

      {state.status === "created" && (
        <div role="status" className="flex flex-col gap-3 rounded-md border border-neutral-400 p-4">
          <p>{t.created.replace("{email}", state.email)}</p>
          {/* `window` n'est lu qu'ici : cet état n'existe qu'après une action, côté navigateur. */}
          <CopyableLink url={`${window.location.origin}${state.path}`} />
          <p className="text-sm text-neutral-700">
            {t.expiresOn.replace("{date}", formatDateTime(new Date(state.expiresAt)))}
          </p>
        </div>
      )}
    </div>
  );
}