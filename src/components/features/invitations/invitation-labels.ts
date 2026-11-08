/**
 * Textes d'une invitation dans la liste de l'admin (bloc 10) : sa ligne de dates
 * (« Envoyée le … · expire le … ») et le compteur. Purs.
 */
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import type { InvitationSummary } from "@/server/db/invitations";

const t = fr.admin.invitations;

/** Date de l'événement qui fixe le statut (expiration à venir ou passée, acceptation…). */
function statusDate(invitation: InvitationSummary): Date {
  switch (invitation.status) {
    case "accepted":
      return invitation.acceptedAt ?? invitation.expiresAt;
    case "revoked":
      return invitation.revokedAt ?? invitation.expiresAt;
    case "pending":
    case "expired":
      return invitation.expiresAt;
  }
}

export function invitationTimeline(invitation: InvitationSummary): string {
  const sent = t.sentOn.replace("{date}", formatDateTime(invitation.createdAt));
  const event = t.timeline[invitation.status].replace(
    "{date}",
    formatDateTime(statusDate(invitation)),
  );
  return `${sent} · ${event}`;
}

/** « 2 en attente · 5 invitations ». */
export function invitationCounts(invitations: readonly InvitationSummary[]): string {
  const pending = invitations.filter((invitation) => invitation.status === "pending").length;
  const total = invitations.length;
  const pendingText =
    pending === 1 ? t.pendingOne : t.pendingMany.replace("{count}", String(pending));
  // En français, 0 et 1 prennent le singulier.
  const totalText = (total <= 1 ? t.totalOne : t.totalMany).replace("{count}", String(total));
  return `${pendingText} · ${totalText}`;
}
