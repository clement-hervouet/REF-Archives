/**
 * Recherche instantanée dans une liste (bloc 10) : comparaison sans accents ni casse,
 * chaque mot de la recherche devant apparaître quelque part. Pur.
 */

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texte indexé à partir de plusieurs champs (les vides sont ignorés). */
export function searchText(parts: readonly (string | null | undefined)[]): string {
  return normalizeSearch(parts.filter((part): part is string => Boolean(part)).join(" "));
}

/** Vrai si chaque mot de `query` apparaît dans `text` (déjà normalisé). */
export function matchesSearch(text: string, query: string): boolean {
  const words = normalizeSearch(query)
    .split(" ")
    .filter((word) => word !== "");
  return words.every((word) => text.includes(word));
}
