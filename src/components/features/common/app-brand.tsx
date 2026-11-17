/**
 * Nom de l'application au-dessus du titre des pages hors connexion (connexion, mot de passe
 * oublié, invitation…), bloc 13 : sans lui, rien ne disait sur quel site on se trouvait.
 * Même style que l'en-tête de la barre latérale, précédé du logo.
 */
import { fr } from "@/i18n/fr";
import { AppLogo } from "./app-logo";

export function AppBrand() {
  return (
    <p className="-mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <AppLogo tile className="size-7" />
      {fr.app.name}
      <span className="sr-only"> — {fr.app.tagline}</span>
    </p>
  );
}
