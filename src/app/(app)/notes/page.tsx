import Link from "next/link";
import { GameNoteList } from "@/components/features/games/game-note-list";
import { GameNotesFilters } from "@/components/features/games/game-notes-filters";
import { fr } from "@/i18n/fr";
import { GAME_NOTES_PATH } from "@/lib/app-paths";
import { gameNotesSearch, parseGameNotesFilters } from "@/lib/schemas/game-notes-filters";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listClubs } from "@/server/db/clubs";
import { listGamesWithNotes } from "@/server/db/game-notes";
import { getDb } from "@/server/db/pool";

const t = fr.gameNotes;

const LINK_CLASS = "inline-flex min-h-11 items-center rounded-md border border-neutral-400 px-4";

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type GameNotesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GameNotesPage(props: GameNotesPageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const filters = parseGameNotesFilters(await props.searchParams);
  const db = getDb();
  const [clubs, page] = await Promise.all([
    listClubs(db, user.id),
    listGamesWithNotes(db, { userId: user.id, filters }),
  ]);
  const filtered =
    filters.category !== null ||
    filters.level !== null ||
    filters.type !== null ||
    filters.clubId !== null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">{t.intro}</p>
      </section>

      <GameNotesFilters filters={filters} clubs={clubs} />

      {page.items.length === 0 ? (
        <p>{filtered || filters.page > 1 ? t.emptyFiltered : t.empty}</p>
      ) : (
        <GameNoteList items={page.items} />
      )}

      {(filters.page > 1 || page.hasMore) && (
        <nav aria-label={t.pagination} className="flex flex-wrap items-center gap-3">
          {filters.page > 1 && (
            <Link
              href={`${GAME_NOTES_PATH}${gameNotesSearch({ ...filters, page: filters.page - 1 })}`}
              className={LINK_CLASS}
            >
              {t.previous}
            </Link>
          )}
          <span className="text-sm text-neutral-700">
            {t.pageLabel.replace("{page}", String(filters.page))}
          </span>
          {page.hasMore && (
            <Link
              href={`${GAME_NOTES_PATH}${gameNotesSearch({ ...filters, page: filters.page + 1 })}`}
              className={LINK_CLASS}
            >
              {t.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
