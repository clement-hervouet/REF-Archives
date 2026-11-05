/**
 * Lien d'itinéraire vers l'adresse d'un match. URL « universelle » de Google Maps : elle
 * ouvre l'application sur mobile et le site sur ordinateur. Rien n'est appelé côté
 * serveur (§6.4 A10) : c'est un simple lien que l'utilisateur choisit d'ouvrir.
 */

const MAPS_SEARCH_URL = "https://www.google.com/maps/search/";

/** URL d'itinéraire pour une adresse en texte libre (encodée, jamais concaténée brute). */
export function itineraryUrl(address: string): string {
  const url = new URL(MAPS_SEARCH_URL);
  url.searchParams.set("api", "1");
  url.searchParams.set("query", address);
  return url.href;
}
