/**
 * Filtres de la page « Notes de match » : un simple formulaire GET, sans JavaScript.
 * Les valeurs repartent dans l'URL et sont revalidées côté serveur
 * (`parseGameNotesFilters`).
 */
import Link from "next/link";
import {
  FIELD_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { GAME_NOTES_PATH } from "@/lib/app-paths";
import {
  GAME_NOTE_CATEGORIES,
  GAME_NOTE_LEVELS,
  GAME_NOTE_TYPES,
} from "@/lib/schemas/game-notes-filters";
import type { GameNotesFilters as Filters } from "@/lib/schemas/game-notes-filters";
import type { ClubSummary } from "@/server/db/clubs";

const t = fr.gameNotes.filters;
const divisions = fr.scales.divisions;

type Props = { filters: Filters; clubs: readonly Pick<ClubSummary, "id" | "name">[] };

export function GameNotesFilters({ filters, clubs }: Props) {
  return (
    <form method="get" action={GAME_NOTES_PATH} className="flex flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-neutral-300 p-4">
        <legend className="px-1 font-semibold">{t.legend}</legend>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-category" className="text-sm font-medium">
              {t.category}
            </label>
            <select
              id="filter-category"
              name="categorie"
              defaultValue={filters.category ?? ""}
              className={FIELD_CLASS}
            >
              <option value="">{t.all}</option>
              {GAME_NOTE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {divisions.category[category]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-level" className="text-sm font-medium">
              {t.level}
            </label>
            <select
              id="filter-level"
              name="niveau"
              defaultValue={filters.level ?? ""}
              className={FIELD_CLASS}
            >
              <option value="">{t.all}</option>
              {GAME_NOTE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t.levels[level]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-type" className="text-sm font-medium">
              {t.type}
            </label>
            <select
              id="filter-type"
              name="type"
              defaultValue={filters.type ?? ""}
              className={FIELD_CLASS}
            >
              <option value="">{t.all}</option>
              {GAME_NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {divisions.type[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-club" className="text-sm font-medium">
              {t.club}
            </label>
            <select
              id="filter-club"
              name="club"
              defaultValue={filters.clubId ?? ""}
              className={FIELD_CLASS}
            >
              <option value="">{t.all}</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            {t.submit}
          </button>
          <Link
            href={GAME_NOTES_PATH}
            className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center`}
          >
            {t.reset}
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
