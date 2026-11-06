/**
 * Recherche des collègues (bloc 10) : comparaison sans accents ni casse, chaque mot de la
 * recherche devant apparaître quelque part (nom, prénom ou club). Pur.
 */

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte indexé d'un collègue. */
export function colleagueSearchText(input: {
  firstname: string | null;
  lastname: string;
  clubName: string | null;
}): string {
  return normalizeSearch(
    [input.firstname, input.lastname, input.clubName].filter(Boolean).join(" "),
  );
}

/** Vrai si chaque mot de `query` apparaît dans `searchText` (déjà normalisé). */
export function matchesSearch(searchText: string, query: string): boolean {
  const words = normalizeSearch(query)
    .split(" ")
    .filter((word) => word !== "");
  return words.every((word) => searchText.includes(word));
}
