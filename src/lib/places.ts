/**
 * Comparaison de noms de lieux (villes, salles), partagée par l'annuaire FFBB (serveur) et
 * les formulaires de clubs (navigateur). Sans dépendance.
 */

/**
 * Forme comparable d'un nom de lieu : minuscules sans accents ni ponctuation, « st » et
 * « ste » développés. « St-Grégoire » → « saint gregoire ». C'est aussi ce qui est envoyé
 * à la recherche FFBB, qui ne trouve pas « Bédée » mais trouve « bedee ».
 */
export function normalizePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\bst\b/g, "saint")
    .replace(/\bste\b/g, "sainte");
}

/**
 * Vrai si `city` est la ville de référence `homeCity` (« Saint-Grégoire » = « ST
 * GREGOIRE »). Sans ville de référence, tout lieu convient ; un lieu sans ville, jamais.
 */
export function isSameCity(city: string | null, homeCity: string | null): boolean {
  if (homeCity === null) {
    return true;
  }
  return city !== null && normalizePlace(city) === normalizePlace(homeCity);
}
