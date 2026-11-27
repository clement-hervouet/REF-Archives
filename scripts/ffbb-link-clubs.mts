/**
 * Rattrapage ponctuel : lie à l'annuaire FFBB les clubs créés avant les logos (sans
 * `ffbb_id`), pour qu'ils aient leur pastille. Le logo se télécharge ensuite tout seul, au
 * premier affichage.
 *
 * Pour chaque club : recherche par la ville de sa salle principale, puis, sans résultat,
 * par son nom ; lien seulement si un seul club de l'annuaire correspond (même département,
 * même nom ou mêmes mots significatifs : `src/server/ffbb/club-matching.ts`). Les autres
 * restent à lier à la main (onglet « Clubs », « Lier à l'annuaire FFBB »).
 *
 * Lent exprès : une requête vers l'API toutes les `--pause` secondes au plus (2 par
 * défaut), chaque recherche n'est faite qu'une fois, et une panne est retentée deux fois.
 * Interrompu (Ctrl+C), il reprend où il en était : seuls les clubs encore sans lien sont lus.
 *
 * Usage :
 *   pnpm ffbb:link-clubs                         essai : affiche ce qui serait lié
 *   pnpm ffbb:link-clubs --appliquer             enregistre les liens
 *   options : --pause=<secondes> (défaut 2), --max=<nombre de clubs>
 * En production :
 *   docker compose run --rm tools node scripts/ffbb-link-clubs.mts [--appliquer]
 */
import pg from "pg";
import { z } from "zod";
import { matchClub } from "../src/server/ffbb/club-matching.ts";
import type { ClubMatch, ClubToMatch } from "../src/server/ffbb/club-matching.ts";
import { createFfbbFetch, searchFfbbClubCandidates } from "../src/server/ffbb/ffbb-clubs.ts";
import type { FfbbFetch } from "../src/server/ffbb/ffbb-clubs.ts";

const envSchema = z.object({ DATABASE_URL: z.url() });

const optionsSchema = z.object({
  apply: z.boolean(),
  pauseSeconds: z.number().min(0.5).max(600),
  max: z.number().int().positive().nullable(),
});

type Options = z.output<typeof optionsSchema>;

const USAGE =
  "Usage : node scripts/ffbb-link-clubs.mts [--appliquer] [--pause=<secondes>] [--max=<nombre>]";

function parseOptions(args: readonly string[]): Options {
  let apply = false;
  let pauseSeconds = 2;
  let max: number | null = null;
  for (const arg of args) {
    const [name, value] = arg.split("=", 2);
    if (name === "--appliquer" && value === undefined) {
      apply = true;
    } else if (name === "--pause" && value !== undefined) {
      pauseSeconds = Number(value);
    } else if (name === "--max" && value !== undefined) {
      max = Number(value);
    } else {
      throw new Error(`Option inconnue : ${arg}\n${USAGE}`);
    }
  }
  const parsed = optionsSchema.safeParse({ apply, pauseSeconds, max });
  if (!parsed.success) {
    throw new Error(`Options invalides (pause de 0,5 à 600 s, max entier positif).\n${USAGE}`);
  }
  return parsed.data;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Délais avant chaque nouvel essai d'une requête en échec. */
const RETRY_DELAYS_MS = [10_000, 30_000];

/**
 * Accès à l'API, ralenti (une requête toutes les `pauseMs` au plus), mis en cache (une
 * même recherche n'est faite qu'une fois) et retenté en cas de panne.
 */
function slowFetch(pauseMs: number): FfbbFetch {
  const fetchJson = createFfbbFetch();
  const cache = new Map<string, Promise<unknown>>();
  let nextAt = 0;
  const throttled = async (path: string): Promise<unknown> => {
    for (let attempt = 0; ; attempt++) {
      const wait = nextAt - Date.now();
      if (wait > 0) {
        await sleep(wait);
      }
      nextAt = Date.now() + pauseMs;
      try {
        return await fetchJson(path);
      } catch (error) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) {
          throw error;
        }
        console.warn(`  (API indisponible, nouvel essai dans ${String(delay / 1000)} s)`);
        await sleep(delay);
      }
    }
  };
  return (path) => {
    let pending = cache.get(path);
    if (pending === undefined) {
      pending = throttled(path);
      // Un échec n'est pas gardé : une autre recherche identique le retentera.
      pending.catch(() => cache.delete(path));
      cache.set(path, pending);
    }
    return pending;
  };
}

type Outcome = ClubMatch | { status: "error" };

/** Recherche par la ville de la salle, puis par le nom si rien ne correspond. */
async function findClub(fetchJson: FfbbFetch, club: ClubToMatch): Promise<Outcome> {
  const queries = [club.city, club.name].filter((query) => query !== null);
  let failed = false;
  for (const query of queries) {
    const found = await searchFfbbClubCandidates(fetchJson, query);
    if (!found.ok) {
      failed = true;
      continue;
    }
    const match = matchClub(club, found.value);
    if (match.status !== "not_found") {
      return match;
    }
  }
  return failed ? { status: "error" } : { status: "not_found" };
}

const LIST_UNLINKED_CLUBS_SQL = `SELECT c.id, c.user_id, c.name, a.postal_code, a.city
FROM club c
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
WHERE c.ffbb_id IS NULL
ORDER BY lower(a.city) NULLS LAST, c.name, c.id
LIMIT $1`;

const clubRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  name: z.string(),
  postal_code: z.string(),
  city: z.string().nullable(),
});

// Un lien posé entre-temps (à la main, dans l'application) n'est jamais remplacé.
const LINK_CLUB_SQL = `UPDATE club SET ffbb_id = $3, ffbb_logo_uuid = $4, color = $5
WHERE id = $1 AND user_id = $2 AND ffbb_id IS NULL`;

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const env = envSchema.parse(process.env);
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(LIST_UNLINKED_CLUBS_SQL, [options.max]);
    const clubs = result.rows.map((raw) => clubRowSchema.parse(raw));
    console.log(
      `${String(clubs.length)} club(s) sans lien FFBB${options.apply ? "" : " (essai : rien n'est enregistré)"}.`,
    );
    const fetchJson = slowFetch(options.pauseSeconds * 1000);
    const counts = { linked: 0, ambiguous: 0, notFound: 0, error: 0 };
    for (const [index, club] of clubs.entries()) {
      const label = `[${String(index + 1)}/${String(clubs.length)}] ${club.name} (${club.postal_code})`;
      const outcome = await findClub(fetchJson, {
        name: club.name,
        postalCode: club.postal_code,
        city: club.city,
      });
      if (outcome.status === "found") {
        const { candidate } = outcome;
        if (options.apply) {
          await client.query(LINK_CLUB_SQL, [
            club.id,
            club.user_id,
            candidate.ffbb.id,
            candidate.ffbb.logoUuid,
            candidate.ffbb.color,
          ]);
        }
        counts.linked++;
        const how = outcome.level === "name" ? "même nom" : "mêmes mots";
        const logo = candidate.ffbb.logoUuid === null ? ", sans logo" : "";
        console.log(`${label} → ${candidate.name} (${how}${logo})`);
      } else if (outcome.status === "ambiguous") {
        counts.ambiguous++;
        const names = outcome.candidates.map((candidate) => candidate.name).join(" ; ");
        console.log(`${label} : ambigu, à lier à la main (${names})`);
      } else if (outcome.status === "not_found") {
        counts.notFound++;
        console.log(`${label} : introuvable, à lier à la main`);
      } else {
        counts.error++;
        console.log(`${label} : API indisponible, à relancer`);
      }
    }
    console.log(
      `\n${options.apply ? "Liés" : "À lier"} : ${String(counts.linked)} · ambigus : ${String(counts.ambiguous)}` +
        ` · introuvables : ${String(counts.notFound)} · erreurs API : ${String(counts.error)}`,
    );
    if (!options.apply && counts.linked > 0) {
      console.log("Relancer avec --appliquer pour enregistrer ces liens.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
