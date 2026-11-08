import { InvitationStatusBadge } from "@/components/features/invitations/invitation-status-badge";
import {
  invitationCounts,
  invitationTimeline,
} from "@/components/features/invitations/invitation-labels";
import { SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { listInvitations } from "@/server/db/invitations";
import type { InvitationSummary } from "@/server/db/invitations";
import { getDb } from "@/server/db/pool";
import { revokeInvitationAction } from "./actions";
import { CreateInvitationForm } from "./create-invitation-form";

const t = fr.admin.invitations;

function InvitationRow({ invitation }: { invitation: InvitationSummary }) {
  return (
    <li className="grid items-center gap-x-4 gap-y-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium break-all">{invitation.email}</p>
        <p className="text-sm text-muted-foreground">{invitationTimeline(invitation)}</p>
      </div>
      <div className="flex items-center gap-3 sm:contents">
        <InvitationStatusBadge status={invitation.status} />
        {invitation.status === "pending" && (
          <form action={revokeInvitationAction} className="ml-auto sm:ml-0">
            <input type="hidden" name="invitationId" value={invitation.id} />
            <button
              type="submit"
              aria-label={t.revokeFor.replace("{email}", invitation.email)}
              className={SECONDARY_BUTTON_CLASS}
            >
              {t.revoke}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

export default async function InvitationsPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const admin = await requireAdminOrRedirect();
  const invitations = await listInvitations(getDb(), admin.id, new Date());
  const pending = invitations.filter((invitation) => invitation.status === "pending");
  const history = invitations.filter((invitation) => invitation.status !== "pending");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      <section
        aria-labelledby="invitation-new"
        className="flex flex-col gap-3 rounded-md border border-border p-4"
      >
        <h2 id="invitation-new" className="text-lg font-semibold">
          {t.newTitle}
        </h2>
        <CreateInvitationForm />
      </section>

      <section aria-labelledby="invitation-list" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="invitation-list" className="text-lg font-semibold">
            {t.listTitle}
          </h2>
          {invitations.length > 0 && (
            <p className="text-sm text-muted-foreground">{invitationCounts(invitations)}</p>
          )}
        </div>
        {invitations.length === 0 ? (
          <p className="text-muted-foreground">{t.empty}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="font-medium">{t.pendingTitle}</h3>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noPending}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pending.map((invitation) => (
                    <InvitationRow key={invitation.id} invitation={invitation} />
                  ))}
                </ul>
              )}
            </div>
            {history.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">{t.historyTitle}</h3>
                <ul className="flex flex-col gap-2">
                  {history.map((invitation) => (
                    <InvitationRow key={invitation.id} invitation={invitation} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
