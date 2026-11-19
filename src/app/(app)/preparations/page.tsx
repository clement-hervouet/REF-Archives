import Link from "next/link";
import { PageTitle } from "@/components/features/common/page-title";
import {
  GameNotesFilters,
  activeFilterCount,
} from "@/components/features/games/game-notes-filters";
import { PreparationList } from "@/components/features/games/preparation-list";
import { PRIMARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { NEW_GAME_TO_PREPARE_PATH, PREPARATIONS_PATH } from "@/lib/app-paths";
import { gameNotesSearch, parseGameNotesFilters } from "@/lib/schemas/game-notes-filters";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listClubs } from "@/server/db/clubs";
import { getDb } from "@/server/db/pool";
import { listPreparations } from "@/server/db/preparations";

const t = fr.preparations;

const LINK_CLASS = "inline-flex min-h-11 items-center rounded-md border border-input px-4";

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type PreparationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** « Préparation de match » (§15.4.10) : mêmes filtres que « Notes de match ». */
export default async function PreparationsPage(props: PreparationsPageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  // « Matchs sans note » n'a pas de sens ici : ignoré même s'il est dans l'URL.
  const filters = { ...parseGameNotesFilters(await props.searchParams), includeWithoutNote: false };
  const db = getDb();
  const [clubs, page] = await Promise.all([
    listClubs(db, user.id),
    listPreparations(db, { userId: user.id, filters }),
  ]);
  const filtered = activeFilterCount(filters) > 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <PageTitle>{t.title}</PageTitle>
          <p className="text-muted-foreground">{t.intro}</p>
        </div>
        {/* Comme sur « Notes de match » : un match sans indemnité se prépare aussi. */}
        <Link
          href={NEW_GAME_TO_PREPARE_PATH}
          className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center self-start`}
        >
          {t.newGame.create}
        </Link>
      </section>

      <GameNotesFilters
        filters={filters}
        clubs={clubs}
        action={PREPARATIONS_PATH}
        withNoteToggle={false}
      />

      {page.items.length === 0 ? (
        <p className="rounded-md border border-border p-4">
          {filtered || filters.page > 1 ? t.emptyFiltered : t.empty}
        </p>
      ) : (
        <PreparationList items={page.items} />
      )}

      {(filters.page > 1 || page.hasMore) && (
        <nav aria-label={t.pagination} className="flex flex-wrap items-center gap-3">
          {filters.page > 1 && (
            <Link
              href={`${PREPARATIONS_PATH}${gameNotesSearch({ ...filters, page: filters.page - 1 })}`}
              className={LINK_CLASS}
            >
              {fr.gameNotes.previous}
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            {fr.gameNotes.pageLabel.replace("{page}", String(filters.page))}
          </span>
          {page.hasMore && (
            <Link
              href={`${PREPARATIONS_PATH}${gameNotesSearch({ ...filters, page: filters.page + 1 })}`}
              className={LINK_CLASS}
            >
              {fr.gameNotes.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
