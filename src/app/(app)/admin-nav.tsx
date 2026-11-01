import Link from "next/link";
import { fr } from "@/i18n/fr";
import { getCurrentUser } from "@/server/auth/session";

/** Lien d'administration, visible uniquement pour un admin (confort : l'accès est contrôlé côté page). */
export async function AdminNav() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return null;
  }
  return (
    <Link href="/admin/invitations" className="inline-flex min-h-11 items-center px-3 underline">
      {fr.nav.invitations}
    </Link>
  );
}