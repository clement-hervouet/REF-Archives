/**
 * Rattachement d'un club existant à l'annuaire FFBB (`scripts/ffbb-link-clubs.mts`) :
 * parmi les clubs trouvés par une recherche, lequel est le sien ? Règle prudente, un lien
 * faux étant pire qu'un lien absent (il se pose alors à la main, onglet « Clubs ») :
 *  1. même département que l'adresse du club (la salle principale d'un club de
 *     l'annuaire n'a pas toujours le code postal de son siège, mais reste dans son
 *     département) ;
 *  2. même nom, sans accents ni ponctuation : le cas des clubs créés depuis l'annuaire ;
 *  3. à défaut, mêmes mots significatifs (« BC BÉTHUNE » = « BÉTHUNE BASKET CLUB ») ;
 *  4. un seul candidat à ce niveau, sinon c'est ambigu et rien n'est lié.
 *
 * Imports relatifs en `.ts` : module lancé aussi par Node sans les alias de Next.js.
 */
import { normalizePlace } from "../../lib/places.ts";
import type { FfbbClubCandidate } from "./ffbb-clubs.ts";

/** Club de l'utilisateur : son nom et l'adresse de sa salle principale. */
export type ClubToMatch = { name: string; postalCode: string; city: string | null };

export type ClubMatch =
  | { status: "found"; candidate: FfbbClubCandidate; level: "name" | "words" }
  | { status: "ambiguous"; candidates: readonly FfbbClubCandidate[] }
  | { status: "not_found" };

/** Mots trop courants pour distinguer deux clubs (normalisés par `normalizePlace`). */
const GENERIC_WORDS = new Set([
  "basket",
  "basketball",
  "ball",
  "club",
  "bc",
  "bb",
  "bbc",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "l",
  "d",
  "et",
  "en",
]);

/**
 * Département d'un code postal français : deux chiffres, trois en outre-mer (971 à 989).
 * La Corse (20…) reste « 20 ». `null` hors de France.
 */
export function departmentOf(postalCode: string | null): string | null {
  const code = postalCode?.trim() ?? "";
  if (!/^\d{5}$/.test(code)) {
    return null;
  }
  return code.startsWith("97") || code.startsWith("98") ? code.slice(0, 3) : code.slice(0, 2);
}

/** Mots significatifs d'un nom, triés et sans doublon (« BC BÉTHUNE » → « bethune »). */
export function significantWords(name: string): string {
  const words = normalizePlace(name)
    .split(" ")
    .filter((word) => word !== "" && !GENERIC_WORDS.has(word));
  return [...new Set(words)].sort().join(" ");
}

/** Candidat du même département (ou, sans code postal FFBB, de la même ville). */
function isNearby(club: ClubToMatch, candidate: FfbbClubCandidate): boolean {
  const department = departmentOf(club.postalCode);
  if (candidate.postalCode !== null) {
    return department !== null && departmentOf(candidate.postalCode) === department;
  }
  return (
    club.city !== null &&
    candidate.city !== null &&
    normalizePlace(club.city) === normalizePlace(candidate.city)
  );
}

function pick(matches: readonly FfbbClubCandidate[], level: "name" | "words"): ClubMatch | null {
  const [first, ...others] = matches;
  if (first === undefined) {
    return null;
  }
  return others.length === 0
    ? { status: "found", candidate: first, level }
    : { status: "ambiguous", candidates: matches };
}

/** Le club de l'annuaire qui correspond à `club`, s'il n'y en a qu'un. */
export function matchClub(club: ClubToMatch, candidates: readonly FfbbClubCandidate[]): ClubMatch {
  const nearby = candidates.filter((candidate) => isNearby(club, candidate));
  const name = normalizePlace(club.name);
  const sameName = nearby.filter((candidate) => normalizePlace(candidate.name) === name);
  const byName = pick(sameName, "name");
  if (byName !== null) {
    return byName;
  }
  const words = significantWords(club.name);
  if (words === "") {
    return { status: "not_found" };
  }
  const sameWords = nearby.filter((candidate) => significantWords(candidate.name) === words);
  return pick(sameWords, "words") ?? { status: "not_found" };
}
