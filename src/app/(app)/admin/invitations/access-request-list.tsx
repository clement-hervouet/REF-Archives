"use client";

/**
 * Demandes d'accès en attente (§15.4.4) : une ligne par demande, avec « Inviter » et
 * « Refuser ». Le résultat d'« Inviter » (lien, avertissement si l'email n'est pas parti)
 * s'affiche au-dessus de la liste : il reste visible quand la ligne disparaît après coup.
 */
import { useActionState } from "react";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { inviteFromAccessRequestAction, refuseAccessRequestAction } from "./actions";
import type { AccessRequestActionState } from "./actions";
import { InvitationCreatedNotice } from "./create-invitation-form";

const t = fr.admin.invitations;

/** Une demande telle qu'affichée : la date est mise en forme côté serveur (fuseau de Paris). */
export type AccessRequestRow = {
  id: string;
  name: string;
  email: string;
  receivedLabel: string;
};

function errorMessage(state: AccessRequestActionState): string | null {
  switch (state.status) {
    case "not_found":
      return t.requests.errors.notFound;
    case "email_taken":
      return t.requests.errors.emailTaken.replace("{email}", state.email);
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

export function AccessRequestList({ requests }: { requests: readonly AccessRequestRow[] }) {
  const [state, inviteAction, isPending] = useActionState(inviteFromAccessRequestAction, {
    status: "idle",
  });
  const message = errorMessage(state);

  return (
    <div className="flex flex-col gap-3">
      {message !== null && (
        <p
          role="alert"
          className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
        >
          {message}
        </p>
      )}
      {state.status === "created" && <InvitationCreatedNotice invitation={state} />}

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.requests.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((request) => (
            <li
              key={request.id}
              className="grid items-center gap-x-4 gap-y-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="font-medium break-words">{request.name}</p>
                <p className="text-sm break-all">{request.email}</p>
                <p className="text-sm text-muted-foreground">{request.receivedLabel}</p>
              </div>
              <div className="flex gap-2">
                <form action={inviteAction} className="flex-1 sm:flex-none">
                  <input type="hidden" name="requestId" value={request.id} />
                  <button
                    type="submit"
                    disabled={isPending}
                    aria-label={t.requests.inviteFor
                      .replace("{name}", request.name)
                      .replace("{email}", request.email)}
                    className={`${PRIMARY_BUTTON_CLASS} w-full`}
                  >
                    {isPending ? t.requests.inviting : t.requests.invite}
                  </button>
                </form>
                <form action={refuseAccessRequestAction} className="flex-1 sm:flex-none">
                  <input type="hidden" name="requestId" value={request.id} />
                  <button
                    type="submit"
                    disabled={isPending}
                    aria-label={t.requests.refuseFor
                      .replace("{name}", request.name)
                      .replace("{email}", request.email)}
                    className={`${SECONDARY_BUTTON_CLASS} w-full`}
                  >
                    {t.requests.refuse}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
