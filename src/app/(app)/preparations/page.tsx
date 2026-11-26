import Link from "next/link";
import { PageTitle } from "@/components/features/common/page-title";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import {
  GameNotesFilters,
  activeFilterCount,
} from "@/components/features/games/game-notes-filters";
import { PreparationList } from "@/components/features/games/preparation-list";
import { fullNameOf } from "@/components/features/games/shared-preparation-labels";
import { PRIMARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { NEW_GAME_TO_PREPARE_PATH, PREPARATIONS_PATH } from "@/lib/app-paths";
import { gameNotesSearch, parseGameNotesFilters } from "@/lib/schemas/game-notes-filters";
import type { GameNotesFilters as Filters } from "@/lib/schemas/game-notes-filters";
import { cn } from "@/lib/utils";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listClubs } from "@/server/db/clubs";
import { listLinkedOwners } from "@/server/db/colleague-links";
import { getDb } from "@/server/db/pool";
import { listPreparations } from "@/server/db/preparations";
import { listRecipientPreparations } from "@/server/db/shared-preparations";
import { unlinkFromOwnerAction } from "./share-actions";

const t = fr.preparations;
const ts = fr.sharing;

const LINK_CLASS = "inline-flex min-h-11 items-center rounded-md border border-input px-4";

/** Valeur de `?vue=` de l'onglet « Partagées avec moi ». */
const SHARED_VIEW = "partagees";

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type PreparationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Lien vers une page de la liste, en gardant l'onglet. */
function pageHref(filters: Filters, page: number, shared: boolean): string {
  const search = gameNotesSearch({ ...filters, page });
  if (!shared) {
    return `${PREPARATIONS_PATH}${search}`;
  }
  return `${PREPARATIONS_PATH}${search === "" ? "?" : `${search}&`}vue=${SHARED_VIEW}`;
}

function Tabs({ shared }: { shared: boolean }) {
  const tab = (href: string, label: string, current: boolean) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center border-b-2 px-3",
        current ? "border-primary font-semibold" : "border-transparent text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label={ts.tabs.label} className="flex gap-2 border-b border-border">
      {tab(PREPARATIONS_PATH, ts.tabs.mine, !shared)}
      {tab(`${PREPARATIONS_PATH}?vue=${SHARED_VIEW}`, ts.tabs.shared, shared)}
    </nav>
  );
}

/**
 * « Préparation de match » (§15.4.10) : mêmes filtres que « Notes de match ». Deux onglets :
 * ses préparations, et celles que des collègues lui ont partagées (migration 035).
 */
export default async function PreparationsPage(props: PreparationsPageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const searchParams = await props.searchParams;
  const shared = searchParams.vue === SHARED_VIEW;
  // « Matchs sans note » n'a pas de sens ici : ignoré même s'il est dans l'URL. Les clubs
  // d'un collègue ne sont pas les siens : pas de filtre par club sur ses partages.
  const parsed = { ...parseGameNotesFilters(searchParams), includeWithoutNote: false };
  const filters = shared ? { ...parsed, clubId: null } : parsed;
  const db = getDb();
  const [clubs, page, linkedOwners] = await Promise.all([
    shared ? [] : listClubs(db, user.id),
    shared
      ? listRecipientPreparations(db, { viewerId: user.id, filters })
      : listPreparations(db, { userId: user.id, filters }),
    shared ? listLinkedOwners(db, user.id) : [],
  ]);
  const filtered = activeFilterCount(filters) > 0;
  const emptyText = shared
    ? filtered || filters.page > 1
      ? ts.sharedWithMe.emptyFiltered
      : ts.sharedWithMe.empty
    : filtered || filters.page > 1
      ? t.emptyFiltered
      : t.empty;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <PageTitle>{t.title}</PageTitle>
          <p className="text-muted-foreground">{shared ? ts.sharedWithMe.intro : t.intro}</p>
        </div>
        {/* Comme sur « Notes de match » : un match sans indemnité se prépare aussi. */}
        {!shared && (
          <Link
            href={NEW_GAME_TO_PREPARE_PATH}
            className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center self-start`}
          >
            {t.newGame.create}
          </Link>
        )}
      </section>

      <Tabs shared={shared} />

      <GameNotesFilters
        filters={filters}
        clubs={clubs}
        action={PREPARATIONS_PATH}
        withNoteToggle={false}
        withClubFilter={!shared}
        {...(shared ? { view: SHARED_VIEW } : {})}
      />

      {page.items.length === 0 ? (
        <p className="rounded-md border border-border p-4">{emptyText}</p>
      ) : (
        <PreparationList items={page.items} />
      )}

      {(filters.page > 1 || page.hasMore) && (
        <nav aria-label={t.pagination} className="flex flex-wrap items-center gap-3">
          {filters.page > 1 && (
            <Link href={pageHref(filters, filters.page - 1, shared)} className={LINK_CLASS}>
              {fr.gameNotes.previous}
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            {fr.gameNotes.pageLabel.replace("{page}", String(filters.page))}
          </span>
          {page.hasMore && (
            <Link href={pageHref(filters, filters.page + 1, shared)} className={LINK_CLASS}>
              {fr.gameNotes.next}
            </Link>
          )}
        </nav>
      )}

      {shared && linkedOwners.length > 0 && (
        <section
          aria-labelledby="linked-owners"
          className="flex flex-col gap-3 rounded-md border border-border p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="linked-owners" className="text-lg font-semibold">
              {ts.sharedWithMe.linkedOwners}
            </h2>
            <p className="text-sm text-muted-foreground">{ts.sharedWithMe.linkedOwnersIntro}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {linkedOwners.map((owner) => {
              const name = fullNameOf(owner);
              return (
                <li
                  key={owner.userId}
                  className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="font-medium break-words">{name}</p>
                  <ConfirmActionButton
                    action={unlinkFromOwnerAction}
                    hidden={{ name: "ownerId", value: owner.userId }}
                    labels={{
                      submit: ts.sharedWithMe.unlink,
                      ariaLabel: ts.sharedWithMe.unlinkLabel.replace("{name}", name),
                      warning: ts.sharedWithMe.unlinkWarning.replace("{name}", name),
                      confirm: ts.sharedWithMe.unlinkConfirm,
                      cancel: ts.recipient.leaveCancel,
                    }}
                    messages={{
                      unlinked: ts.sharedWithMe.unlinked,
                      not_found: ts.panel.messages.not_found,
                    }}
                    successStatuses={["unlinked"]}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
