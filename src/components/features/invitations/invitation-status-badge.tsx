/**
 * Statut d'une invitation (bloc 10) : pastille colorée et texte, jamais la couleur seule.
 * En attente : jaune ; acceptée : vert ; révoquée ou expirée : neutre (§3.12 : le vert et
 * le jaune teintent le fond et la pastille, pas le texte).
 */
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import type { InvitationStatus } from "@/server/db/invitations";

const STYLES: Record<InvitationStatus, { badge: string; dot: string }> = {
  pending: { badge: "border-warning/60 bg-warning/15", dot: "bg-warning" },
  accepted: { badge: "border-success/50 bg-success/15", dot: "bg-success" },
  revoked: { badge: "border-border bg-muted", dot: "bg-muted-foreground" },
  expired: { badge: "border-border bg-muted", dot: "bg-muted-foreground" },
};

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
        style.badge,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", style.dot)} />
      {fr.admin.invitations.status[status]}
    </span>
  );
}
