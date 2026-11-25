/**
 * Libellés de la préparation partagée : prénom affiché à côté d'une case, liste de noms,
 * « Dernière modification par… ». Pur et sans React : testé à part.
 */
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";

const t = fr.sharing;

type Account = { firstname: string | null; lastname: string | null };

/** Prénom d'un compte (le nom s'il n'a pas de prénom). */
export function firstNameOf(account: Account): string {
  return account.firstname ?? account.lastname ?? "";
}

/** Prénom et nom d'un compte. */
export function fullNameOf(account: Account): string {
  return [account.firstname, account.lastname].filter((part) => part !== null).join(" ");
}

/** Liste de noms pour un message (« Julien, Léa »). */
export function namesList(names: readonly string[]): string {
  return names.join(t.namesSeparator);
}

/**
 * « Dernière modification par … le … » : `vous` pour le compte connecté, sinon le prénom
 * de l'auteur parmi les arbitres du partage. `null` si l'auteur est inconnu (compte
 * supprimé, ou qui ne fait plus partie du partage).
 */
export function modifiedByText(
  preparation: { updatedBy: string | null; updatedAt: Date },
  viewerId: string,
  people: ReadonlyMap<string, string>,
): string | null {
  if (preparation.updatedBy === null) {
    return null;
  }
  const name = preparation.updatedBy === viewerId ? t.you : people.get(preparation.updatedBy);
  if (name === undefined) {
    return null;
  }
  return t.modifiedBy
    .replace("{name}", name)
    .replace("{date}", formatDateTime(preparation.updatedAt));
}
