/**
 * Libellé d'une personne parmi les officiels : « Moi » pour l'utilisateur, sinon
 * « Prénom Nom » (ou le nom seul, le prénom étant facultatif).
 */
import { fr } from "@/i18n/fr";

type Named = { isSelf?: boolean; firstname: string | null; lastname: string | null };

export function personLabel(person: Named): string {
  if (person.isSelf === true) {
    return fr.games.officials.self;
  }
  return [person.firstname, person.lastname].filter((part) => part !== null).join(" ");
}
