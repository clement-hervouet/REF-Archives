import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { listInvitations } from "@/server/db/invitations";
import { getDb } from "@/server/db/pool";
import { revokeInvitationAction } from "./actions";
import { CreateInvitationForm } from "./create-invitation-form";

const t = fr.admin.invitations;

export default async function InvitationsPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const admin = await requireAdminOrRedirect();
  const invitations = await listInvitations(getDb(), admin.id, new Date());

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-xl flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">{t.intro}</p>
        <CreateInvitationForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.listTitle}</h2>
        {invitations.length === 0 ? (
          <p>{t.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-300 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium break-all">{invitation.email}</p>
                  <p className="text-sm text-neutral-700">
                    {t.status[invitation.status]}
                    {invitation.status === "pending" &&
                      ` · ${t.expiresOn.replace("{date}", formatDateTime(invitation.expiresAt))}`}
                  </p>
                </div>
                {invitation.status === "pending" && (
                  <form action={revokeInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <button
                      type="submit"
                      aria-label={t.revokeFor.replace("{email}", invitation.email)}
                      className="min-h-11 rounded-md border border-neutral-400 px-4"
                    >
                      {t.revoke}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}