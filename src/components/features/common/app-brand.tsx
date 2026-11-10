/**
 * Nom de l'application au-dessus du titre des pages hors connexion (connexion, mot de passe
 * oublié, invitation…), bloc 13 : sans lui, rien ne disait sur quel site on se trouvait.
 * Même style que l'en-tête de la barre latérale.
 */
import { fr } from "@/i18n/fr";

export function AppBrand() {
  return (
    <p className="-mb-4 text-sm font-medium text-muted-foreground">
      {fr.app.name}
      <span className="sr-only"> — {fr.app.tagline}</span>
    </p>
  );
}
