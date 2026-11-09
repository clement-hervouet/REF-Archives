"use client";

/**
 * Création d'une invitation (bloc 10) : email et bouton sur une ligne, puis, après succès,
 * un encadré avec le lien (affiché une seule fois) et son bouton « Copier » à côté.
 */
import { useActionState, useState } from "react";
import {
  FIELD_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import { createInvitationAction } from "./actions";
import type { CreateInvitationFormState } from "./actions";

const t = fr.admin.invitations;

function errorMessage(state: CreateInvitationFormState): string | null {
  switch (state.status) {
    case "invalid_email":
      return t.errors.invalidEmail;
    case "email_taken":
      return t.errors.emailTaken;
    case "rate_limited":
      return t.errors.rateLimited.replace(
        "{minutes}",
        String(Math.ceil(state.retryAfterSeconds / 60)),
      );
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
    <div className="flex flex-col gap-1">
      <label htmlFor="invitation-link" className="text-sm font-medium">
        {t.linkLabel}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="invitation-link"
          readOnly
          value={url}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          className={`${FIELD_CLASS} min-w-0 bg-background font-mono text-sm`}
        />
        <button
          type="button"
          onClick={copy}
          className={`${SECONDARY_BUTTON_CLASS} shrink-0 bg-background whitespace-nowrap`}
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
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
          <p
            id="invitation-error"
            role="alert"
            className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
          >
            {message}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="invitation-email" className="text-sm font-medium">
            {t.email}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="invitation-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              aria-describedby={message !== null ? "invitation-error" : undefined}
              aria-invalid={message !== null && state.status !== "rate_limited"}
              className={`${FIELD_CLASS} min-w-0 sm:max-w-md`}
            />
            <button
              type="submit"
              disabled={isPending}
              className={`${PRIMARY_BUTTON_CLASS} shrink-0 self-start whitespace-nowrap`}
            >
              {isPending ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      </form>

      {state.status === "created" && (
        <div
          role="status"
          // Email non parti : avertissement (jaune), l'admin doit transmettre le lien lui-même.
          className={`flex flex-col gap-3 rounded-md border p-4 ${
            state.emailSent ? "border-success/50 bg-success/10" : "border-warning bg-warning/15"
          }`}
        >
          <p>
            {(state.emailSent ? t.createdAndSent : t.createdNotSent).replace(
              "{email}",
              state.email,
            )}
          </p>
          {/* `window` n'est lu qu'ici : cet état n'existe qu'après une action, côté navigateur. */}
          <CopyableLink url={`${window.location.origin}${state.path}`} />
          <p className="text-sm text-muted-foreground">
            {t.expiresOn.replace("{date}", formatDateTime(new Date(state.expiresAt)))}
          </p>
        </div>
      )}
    </div>
  );
}
