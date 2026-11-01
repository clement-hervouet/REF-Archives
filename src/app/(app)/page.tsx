import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";

export default async function HomePage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();

  return (
    <>
      <h1 className="text-2xl font-semibold">{fr.app.name}</h1>
      <p className="mt-2">{fr.auth.signedInAs.replace("{email}", user.email)}</p>
    </>
  );
}