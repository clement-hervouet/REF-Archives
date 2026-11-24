/**
 * Annuaire des clubs de la FFBB (API publique https://ffbb-api.desimone.fr), pour la seule
 * saisie d'un club : recherche des clubs domiciliés dans une ville, puis adresse de leur
 * salle principale. Lecture seule : rien n'est enregistré ici, le formulaire envoie ensuite
 * les champs habituels (nom, adresse).
 *
 * L'API est un service tiers lent et parfois indisponible : toute panne (délai dépassé,
 * erreur HTTP, réponse inattendue) donne `{ ok: false }`, et le formulaire repasse à la
 * saisie manuelle (nom et code postal). Les réponses sont validées par Zod sans rien
 * supposer de plus que les champs utilisés.
 */
import { z } from "zod";

const FFBB_API_URL = "https://ffbb-api.desimone.fr/api/v1";
/** La recherche répond parfois en 5 à 7 s : au-delà de 10 s, on abandonne. */
const TIMEOUT_MS = 10_000;
/** Paris compte environ 150 clubs : la liste défile, on garde une borne de sécurité. */
const MAX_RESULTS = 200;

/** Lit un chemin de l'API (`/search?query=…`) et rend le JSON ; lève en cas d'échec. */
export type FfbbFetch = (path: string) => Promise<unknown>;

export function createFfbbFetch(): FfbbFetch {
  return async (path) => {
    const response = await fetch(`${FFBB_API_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${String(response.status)}`);
    }
    const body: unknown = await response.json();
    return body;
  };
}

export type FfbbResult<T> = { ok: true; value: T } | { ok: false };

/** Nature de l'organisme : un club, une union de clubs ou une entente (CTC). */
type FfbbClubKind = "club" | "union" | "entente" | "other";

/** Club proposé dans la liste : `id` sert ensuite à lire sa fiche. */
export type FfbbClubHit = {
  id: string;
  name: string;
  city: string | null;
  postalCode: string | null;
  kind: FfbbClubKind;
};

/**
 * Fiche réduite aux champs du formulaire : adresse de la salle principale, sinon celle du
 * siège. `postalCode` est `null` si la FFBB n'en donne aucun de valable (saisie manuelle).
 */
export type FfbbClubDetails = {
  name: string;
  /** Nom de la salle principale, pour confirmation à l'écran (non enregistré). */
  venue: string | null;
  street: string | null;
  number: string | null;
  postalCode: string | null;
  city: string | null;
};

// ─── Mise en forme ──────────────────────────────────────────────────────────

/**
 * Forme comparable d'un nom de lieu : minuscules sans accents ni ponctuation, « st » et
 * « ste » développés. « St-Grégoire » → « saint gregoire ». C'est aussi ce qui est envoyé
 * à la recherche, qui ne trouve pas « Bédée » mais trouve « bedee ».
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

const LOWERCASE_WORDS = new Set([
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
  "sur",
  "sous",
  "aux",
  "au",
]);

/**
 * Majuscule en tête de chaque mot, sauf les petits mots de liaison :
 * « SAINT-JACQUES-DE-LA-LANDE » → « Saint-Jacques-de-la-Lande », « BD ALBERT 1ER » →
 * « Bd Albert 1er ».
 */
export function titleCase(value: string): string {
  let first = true;
  return value
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s\-'’])(\p{L}+)/gu, (_match, separator: string, word: string) => {
      const keepLower = !first && LOWERCASE_WORDS.has(word);
      first = false;
      return keepLower
        ? `${separator}${word}`
        : `${separator}${word.charAt(0).toLocaleUpperCase("fr-FR")}${word.slice(1)}`;
    });
}

/** Une seule ligne, sans caractère de contrôle ni espaces en double, tronquée à `max`. */
function cleanText(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const cleaned = value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return cleaned === "" ? null : cleaned;
}

/** Rue saisie tout en majuscules ou tout en minuscules : remise en forme ; sinon gardée. */
function tidyStreet(value: string): string {
  return value === value.toLocaleUpperCase("fr-FR") || value === value.toLocaleLowerCase("fr-FR")
    ? titleCase(value)
    : value;
}

const NUMBER_PATTERN = /^(\d{1,4}(?:\s?(?:bis|ter|quater|[a-d])\b)?)[\s,]+(.+)$/i;

/**
 * Sépare le numéro de la rue : « 12, BD ALBERT 1ER » → 12 + « Bd Albert 1er »,
 * « 09 BIS SQU LOUIS ARMAND » → « 9 bis » + « Squ Louis Armand ». Sans numéro en tête,
 * tout va dans la rue.
 */
export function splitStreet(address: string | null | undefined): {
  number: string | null;
  street: string | null;
} {
  const cleaned = cleanText(address, 300);
  if (cleaned === null) {
    return { number: null, street: null };
  }
  const match = NUMBER_PATTERN.exec(cleaned);
  if (match === null) {
    return { number: null, street: cleanText(tidyStreet(cleaned), 255) };
  }
  const [, rawNumber = "", rawStreet = ""] = match;
  const number = rawNumber
    .replace(/^0+(?=\d)/, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR");
  return { number: cleanText(number, 20), street: cleanText(tidyStreet(rawStreet), 255) };
}

const FRENCH_POSTAL_CODE = /^\d{5}$/;

function postalCodeOf(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return FRENCH_POSTAL_CODE.test(trimmed) ? trimmed : null;
}

/** Arrondissement de Paris, Lyon ou Marseille : la ville seule suffit à l'adresse. */
const ARRONDISSEMENT = /\s+\d{1,2}\s*(?:e|er|ème)\s+arrondissement$/i;

function cityOf(value: string | null | undefined): string | null {
  const cleaned = cleanText(cleanText(value, 255)?.replace(ARRONDISSEMENT, ""), 255);
  return cleaned === null ? null : titleCase(cleaned);
}

// ─── Recherche par ville ────────────────────────────────────────────────────

const searchResponseSchema = z.array(
  z.object({ index_uid: z.string(), hits: z.array(z.unknown()) }),
);

const searchHitSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().regex(/^\d{1,20}$/)),
  nom: z.string().trim().min(1),
  type: z.string().nullish(),
  type_association: z.object({ libelle: z.string().nullish() }).nullish(),
  commune: z.object({ code_postal: z.string().nullish(), libelle: z.string().nullish() }).nullish(),
});

type SearchHit = z.output<typeof searchHitSchema>;

function kindOf(hit: SearchHit): FfbbClubKind {
  const label = normalizePlace(hit.type_association?.libelle ?? "");
  if (label.startsWith("club")) {
    return "club";
  }
  if (label.startsWith("union")) {
    return "union";
  }
  return label.startsWith("entente") ? "entente" : "other";
}

const KIND_ORDER: Record<FfbbClubKind, number> = { club: 0, union: 1, entente: 2, other: 3 };

/**
 * Rang d'un club pour la ville cherchée : 0 s'il y est domicilié (« Paris » couvre
 * « Paris 13e arrondissement »), 1 si la ville figure seulement dans son nom (club d'une
 * commune voisine), `null` sinon.
 */
function placeRank(hit: SearchHit, query: string): 0 | 1 | null {
  const commune = normalizePlace(hit.commune?.libelle ?? "");
  if (commune === query || commune.startsWith(`${query} `)) {
    return 0;
  }
  return ` ${normalizePlace(hit.nom)} `.includes(` ${query} `) ? 1 : null;
}

/**
 * Clubs domiciliés dans `city` (ou portant son nom), clubs d'abord, puis unions et
 * ententes, par ordre alphabétique. Les ligues, comités et la Fédération sont écartés.
 */
export async function searchFfbbClubs(
  fetchJson: FfbbFetch,
  city: string,
): Promise<FfbbResult<FfbbClubHit[]>> {
  const query = normalizePlace(city);
  if (query.length < 2) {
    return { ok: true, value: [] };
  }
  let raw: unknown;
  try {
    raw = await fetchJson(`/search?query=${encodeURIComponent(query)}`);
  } catch (error) {
    console.error(`[ffbb] recherche impossible (${errorName(error)})`);
    return { ok: false };
  }
  const response = searchResponseSchema.safeParse(raw);
  if (!response.success) {
    console.error("[ffbb] réponse de recherche inattendue");
    return { ok: false };
  }
  const index = response.data.find((entry) => entry.index_uid === "ffbbserver_organismes");
  const ranked: { hit: FfbbClubHit; rank: 0 | 1 }[] = [];
  const seen = new Set<string>();
  for (const candidate of index?.hits ?? []) {
    const parsed = searchHitSchema.safeParse(candidate);
    if (!parsed.success || seen.has(parsed.data.id)) {
      continue;
    }
    const hit = parsed.data;
    const rank = placeRank(hit, query);
    if (normalizePlace(hit.type ?? "") !== "groupement" || rank === null) {
      continue;
    }
    seen.add(hit.id);
    ranked.push({
      rank,
      hit: {
        id: hit.id,
        name: cleanText(hit.nom, 255) ?? hit.nom,
        city: cityOf(hit.commune?.libelle),
        postalCode: postalCodeOf(hit.commune?.code_postal),
        kind: kindOf(hit),
      },
    });
  }
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      KIND_ORDER[a.hit.kind] - KIND_ORDER[b.hit.kind] ||
      a.hit.name.localeCompare(b.hit.name, "fr"),
  );
  return { ok: true, value: ranked.slice(0, MAX_RESULTS).map((entry) => entry.hit) };
}

// ─── Fiche d'un club ────────────────────────────────────────────────────────

const communeSchema = z
  .object({ codePostal: z.string().nullish(), libelle: z.string().nullish() })
  .nullish();

const clubResponseSchema = z.object({
  nom: z.string().trim().min(1),
  adresse: z.string().nullish(),
  commune: communeSchema,
  salle: z
    .object({
      libelle: z.string().nullish(),
      adresse: z.string().nullish(),
      commune: communeSchema,
    })
    .nullish(),
});

/** Le club `id` : salle principale si son adresse est exploitable, sinon siège du club. */
export async function getFfbbClub(
  fetchJson: FfbbFetch,
  id: string,
): Promise<FfbbResult<FfbbClubDetails>> {
  let raw: unknown;
  try {
    raw = await fetchJson(`/club/${encodeURIComponent(id)}`);
  } catch (error) {
    console.error(`[ffbb] fiche club impossible (${errorName(error)})`);
    return { ok: false };
  }
  const parsed = clubResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[ffbb] fiche club inattendue");
    return { ok: false };
  }
  const club = parsed.data;
  const name = cleanText(club.nom, 255) ?? club.nom;
  const venue = club.salle;
  const venuePostalCode = postalCodeOf(venue?.commune?.codePostal);
  if (venue && cleanText(venue.adresse, 300) !== null && venuePostalCode !== null) {
    return {
      ok: true,
      value: {
        name,
        venue: cleanText(venue.libelle, 255),
        ...splitStreet(venue.adresse),
        postalCode: venuePostalCode,
        city: cityOf(venue.commune?.libelle),
      },
    };
  }
  return {
    ok: true,
    value: {
      name,
      venue: null,
      ...splitStreet(club.adresse),
      postalCode: postalCodeOf(club.commune?.codePostal),
      city: cityOf(club.commune?.libelle),
    },
  };
}

/** Nom de l'erreur seulement : rien de la réponse n'est journalisé. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "inconnue";
}
