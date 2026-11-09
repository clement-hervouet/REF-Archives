/**
 * Statut d'une invitation (bloc 10) : en attente (jaune), acceptée (vert), révoquée ou
 * expirée (neutre). Badge commun : `common/status-badge.tsx`.
 */
import { StatusBadge } from "@/components/features/common/status-badge";
import type { StatusTone } from "@/components/features/common/status-badge";
import { fr } from "@/i18n/fr";
import type { InvitationStatus } from "@/server/db/invitations";

const TONES: Record<InvitationStatus, StatusTone> = {
  pending: "warning",
  accepted: "success",
  revoked: "neutral",
  expired: "neutral",
};

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  return <StatusBadge tone={TONES[status]}>{fr.admin.invitations.status[status]}</StatusBadge>;
}
