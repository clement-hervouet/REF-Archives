/**
 * Annuaire des clubs de la FFBB (API publique https://ffbb-api.desimone.fr), pour la seule
 * saisie d'un club : recherche des clubs domiciliés dans une ville, puis leurs salles (la
 * principale et celles où ils reçoivent cette saison). Lecture seule : rien n'est
 * enregistré ici, le formulaire envoie ensuite les champs habituels (nom, adresses).
 *
 * L'API est un service tiers lent et parfois indisponible : toute panne (délai dépassé,
 * erreur HTTP, réponse inattendue) donne `{ ok: false }`, et le formulaire repasse à la
 * saisie manuelle (nom et code postal). Les réponses sont validées par Zod sans rien
 * supposer de plus que les champs utilisés.
 */
import { z } from "zod";
import { normalizePlace } from "@/lib/places";
import { ffbbLinkSchema } from "@/lib/schemas/ffbb-link";
import type { FfbbClubLink } from "@/lib/schemas/ffbb-link";

const FFBB_API_URL = "https://ffbb-api.desimone.fr/api/v1";
/** La recherche répond parfois en 5 à 7 s : au-delà de 10 s, on abandonne. */
const TIMEOUT_MS = 10_000;
/** Paris compte environ 150 clubs : la liste défile, on garde une borne de sécurité. */
const MAX_RESULTS = 200;
/** Matchs lus par page, et pages au plus (un gros club joue environ 300 matchs à mi-saison). */
const MATCHES_PAGE_SIZE = 200;
const MAX_MATCHES_PAGES = 5;
/**
 * Une salle où le club n'a reçu qu'une fois (tournoi, match délocalisé) n'est pas une de
 * ses salles : il en faut au moins deux.
 */
const MIN_HOME_MATCHES = 2;
/** Autres salles proposées au plus, des plus utilisées aux moins utilisées. */
const MAX_OTHER_VENUES = 10;

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

/** Salle d'un club : nom et adresse, le code postal toujours connu. */
export type FfbbVenue = {
  name: string | null;
  street: string | null;
  number: string | null;
  postalCode: string;
  city: string | null;
};

/**
 * Fiche réduite aux champs du formulaire : salle principale (celle de la fiche FFBB, sinon
 * celle où le club reçoit le plus, sinon le siège), puis ses autres salles. `postalCode`
 * est `null` si la FFBB n'en donne aucun de valable (saisie manuelle).
 */
export type FfbbClubDetails = {
  name: string;
  /** Nom de la salle principale. */
  venue: string | null;
  street: string | null;
  number: string | null;
  postalCode: string | null;
  city: string | null;
  /** Autres salles où le club reçoit cette saison, de la plus utilisée à la moins utilisée. */
  venues: FfbbVenue[];
  /** Identifiant FFBB, logo et couleur du club, enregistrés avec lui. */
  ffbb: FfbbClubLink;
};

// ─── Mise en forme ──────────────────────────────────────────────────────────

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

/** Texte saisi tout en majuscules ou tout en minuscules : remis en forme ; sinon gardé. */
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

/** Nom d'une salle : « GYMNASE DE LA COURROUZE » → « Gymnase de la Courrouze ». */
function venueNameOf(value: string | null | undefined): string | null {
  const cleaned = cleanText(value, 255);
  return cleaned === null ? null : cleanText(tidyStreet(cleaned), 255);
}

/** « 35000 RENNES » en fin de lieu de match. */
const LOCALITY_PATTERN = /^(\d{5})\s+(.+)$/;

/**
 * Lieu d'un match tel que la FFBB l'écrit, « NOM, RUE, CP VILLE » : « GYMNASE DE LA
 * COURROUZE, 72 RUE CLAUDE BERNARD, 35000 RENNES ». `null` sans code postal en fin.
 */
export function parseLocation(location: string | null | undefined): FfbbVenue | null {
  const parts = (cleanText(location, 500) ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const match = LOCALITY_PATTERN.exec(parts.pop() ?? "");
  if (match === null) {
    return null;
  }
  const [, postalCode = "", city = ""] = match;
  const [name, ...street] = parts;
  return {
    name: venueNameOf(name),
    ...splitStreet(street.join(", ")),
    postalCode,
    city: cityOf(city),
  };
}

/** Même salle : même code postal, puis même nom, ou même rue et même numéro. */
function isSameVenue(a: FfbbVenue, b: FfbbVenue): boolean {
  if (a.postalCode !== b.postalCode) {
    return false;
  }
  const sameName =
    a.name !== null && b.name !== null && normalizePlace(a.name) === normalizePlace(b.name);
  const sameStreet =
    a.street !== null &&
    b.street !== null &&
    normalizePlace(a.street) === normalizePlace(b.street) &&
    a.number === b.number;
  return sameName || sameStreet;
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

/**
 * Logo de la fiche : UUID de l'asset et couleur de fond. Absent pour près de la moitié des
 * clubs ; illisible, il est ignoré sans refuser la fiche.
 */
const logoSchema = z
  .object({ id: z.uuid(), gradient_color: z.string().nullish() })
  .nullish()
  .catch(null);

const clubResponseSchema = z.object({
  nom: z.string().trim().min(1),
  logo: logoSchema,
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

const matchesPageSchema = z.object({
  matches: z.array(z.unknown()),
  pagination: z.object({ total: z.number().int().nonnegative(), has_more: z.boolean() }).nullish(),
});

const matchSchema = z.object({ isHome: z.boolean(), location: z.string().nullish() });

type MatchesPage = z.output<typeof matchesPageSchema>;

/** Matchs de la saison du club (toutes ses équipes), page par page. */
async function readMatches(fetchJson: FfbbFetch, id: string): Promise<unknown[]> {
  const page = async (offset: number): Promise<MatchesPage> =>
    matchesPageSchema.parse(
      await fetchJson(
        `/club/${encodeURIComponent(id)}/matches?limit=${String(MATCHES_PAGE_SIZE)}&offset=${String(offset)}`,
      ),
    );
  const first = await page(0);
  const offsets: number[] = [];
  if (first.pagination?.has_more === true) {
    const total = Math.min(first.pagination.total, MATCHES_PAGE_SIZE * MAX_MATCHES_PAGES);
    for (let offset = MATCHES_PAGE_SIZE; offset < total; offset += MATCHES_PAGE_SIZE) {
      offsets.push(offset);
    }
  }
  const rest = await Promise.all(offsets.map(page));
  return [first, ...rest].flatMap((entry) => entry.matches);
}

/**
 * Salles où le club reçoit cette saison (au moins `MIN_HOME_MATCHES` matchs), de la plus
 * utilisée à la moins utilisée. Facultatives : une panne donne une liste vide.
 */
async function readHomeVenues(fetchJson: FfbbFetch, id: string): Promise<FfbbVenue[]> {
  let matches: unknown[];
  try {
    matches = await readMatches(fetchJson, id);
  } catch (error) {
    console.error(`[ffbb] matchs du club impossibles (${errorName(error)})`);
    return [];
  }
  const counted: { venue: FfbbVenue; count: number }[] = [];
  for (const candidate of matches) {
    const match = matchSchema.safeParse(candidate);
    const venue = match.success && match.data.isHome ? parseLocation(match.data.location) : null;
    if (venue === null) {
      continue;
    }
    const known = counted.find((entry) => isSameVenue(entry.venue, venue));
    if (known === undefined) {
      counted.push({ venue, count: 1 });
    } else {
      known.count += 1;
    }
  }
  return counted
    .filter((entry) => entry.count >= MIN_HOME_MATCHES)
    .sort(
      (a, b) => b.count - a.count || (a.venue.name ?? "").localeCompare(b.venue.name ?? "", "fr"),
    )
    .map((entry) => entry.venue);
}

/** Salle de la fiche FFBB, si son adresse est exploitable. */
function mainVenueOf(club: z.output<typeof clubResponseSchema>): FfbbVenue | null {
  const venue = club.salle;
  const postalCode = postalCodeOf(venue?.commune?.codePostal);
  if (!venue || cleanText(venue.adresse, 300) === null || postalCode === null) {
    return null;
  }
  return {
    name: venueNameOf(venue.libelle),
    ...splitStreet(venue.adresse),
    postalCode,
    city: cityOf(venue.commune?.libelle),
  };
}

/** Lien FFBB du club : une couleur mal formée est abandonnée, le logo gardé. */
function ffbbLinkOf(id: string, club: z.output<typeof clubResponseSchema>): FfbbClubLink {
  const logoUuid = club.logo?.id ?? null;
  const parsed = ffbbLinkSchema.safeParse({
    id,
    logoUuid,
    color: club.logo?.gradient_color ?? null,
  });
  return parsed.success ? parsed.data : { id, logoUuid, color: null };
}

/**
 * Le club `id` et ses salles. Salle principale : celle de sa fiche FFBB, sinon celle où il
 * reçoit le plus, sinon son siège. Fiche et matchs sont lus en même temps ; seule la
 * fiche est indispensable.
 */
export async function getFfbbClub(
  fetchJson: FfbbFetch,
  id: string,
): Promise<FfbbResult<FfbbClubDetails>> {
  const [raw, homeVenues] = await Promise.all([
    fetchJson(`/club/${encodeURIComponent(id)}`).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => {
        console.error(`[ffbb] fiche club impossible (${errorName(error)})`);
        return { ok: false as const };
      },
    ),
    readHomeVenues(fetchJson, id),
  ]);
  if (!raw.ok) {
    return { ok: false };
  }
  const parsed = clubResponseSchema.safeParse(raw.value);
  if (!parsed.success) {
    console.error("[ffbb] fiche club inattendue");
    return { ok: false };
  }
  const club = parsed.data;
  const name = cleanText(club.nom, 255) ?? club.nom;
  const ffbb = ffbbLinkOf(id, club);
  const main = mainVenueOf(club) ?? homeVenues[0] ?? null;
  if (main === null) {
    return {
      ok: true,
      value: {
        name,
        venue: null,
        ...splitStreet(club.adresse),
        postalCode: postalCodeOf(club.commune?.codePostal),
        city: cityOf(club.commune?.libelle),
        venues: [],
        ffbb,
      },
    };
  }
  const { name: venue, ...address } = main;
  return {
    ok: true,
    value: {
      name,
      venue,
      ...address,
      venues: homeVenues.filter((other) => !isSameVenue(other, main)).slice(0, MAX_OTHER_VENUES),
      ffbb,
    },
  };
}

/** Nom de l'erreur seulement : rien de la réponse n'est journalisé. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "inconnue";
}
