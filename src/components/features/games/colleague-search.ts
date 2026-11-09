/**
 * Recherche des collègues (bloc 10) : nom, prénom ou club. Les règles de comparaison sont
 * communes à toutes les listes (`src/lib/search.ts`).
 */
import { searchText } from "@/lib/search";

export { matchesSearch, normalizeSearch } from "@/lib/search";

/** Texte indexé d'un collègue. */
export function colleagueSearchText(input: {
  firstname: string | null;
  lastname: string;
  clubName: string | null;
}): string {
  return searchText([input.firstname, input.lastname, input.clubName]);
}
