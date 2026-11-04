import Link from "next/link";
import { fr } from "@/i18n/fr";
import { getCurrentUser } from "@/server/auth/session";

const LINK_CLASS = "inline-flex min-h-11 items-center px-3 underline";

/** Liens d'administration, visibles uniquement pour un admin (confort : l'accès est contrôlé côté page). */
export async function AdminNav() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return null;
  }
  return (
    <>
      <Link href="/admin/bareme-commun" className={LINK_CLASS}>
        {fr.nav.commonScale}
      </Link>
      <Link href="/admin/invitations" className={LINK_CLASS}>
        {fr.nav.invitations}
      </Link>
    </>
  );
}