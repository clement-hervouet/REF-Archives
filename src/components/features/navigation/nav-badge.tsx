/**
 * Pastille de la navigation : nombre de demandes d'accès en attente à côté de
 * « Invitations » (§15.4.4). Jaune de la palette (§3.12), texte lu par les lecteurs d'écran.
 */
import { pendingRequestsLabel } from "./nav-items";

/** Au-delà, la pastille affiche « 99+ » pour garder sa taille. */
const MAX_SHOWN = 99;

export function NavBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }
  return (
    <span className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-semibold text-warning-foreground">
      <span aria-hidden="true">{count > MAX_SHOWN ? `${String(MAX_SHOWN)}+` : count}</span>
      <span className="sr-only">{pendingRequestsLabel(count)}</span>
    </span>
  );
}
