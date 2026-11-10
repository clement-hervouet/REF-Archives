"use client";

/**
 * Liste avec recherche instantanée (bloc 10), partagée par « Collègues » (cartes en grille)
 * et « Comptes » (lignes). Les éléments sont rendus par la page (serveur) ; ce composant ne
 * fait que les filtrer (`src/lib/search.ts`). Le nombre affiché est annoncé aux lecteurs
 * d'écran.
 */
import { Search } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { FIELD_CLASS } from "@/components/features/scales/form-parts";
import { matchesSearch } from "@/lib/search";

export type SearchableEntry = { id: string; searchText: string; card: ReactNode };

export type SearchLabels = {
  label: string;
  placeholder: string;
  /** « 1 collègue » ; `{count}` remplacé si présent. */
  countOne: string;
  /** « {count} collègues ». */
  countMany: string;
  /** « {shown} sur {total} ». */
  filtered: string;
  /** « Aucun … ne correspond à « {query} ». » */
  none: string;
};

type Props = {
  entries: readonly SearchableEntry[];
  labels: SearchLabels;
  layout?: "grid" | "list";
};

function countLabel(labels: SearchLabels, shown: number, total: number, filtering: boolean) {
  const all = (total <= 1 ? labels.countOne : labels.countMany).replace("{count}", String(total));
  return filtering
    ? labels.filtered.replace("{shown}", String(shown)).replace("{total}", all)
    : all;
}

export function SearchableList({ entries, labels, layout = "grid" }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const filtering = query.trim() !== "";
  const shown = entries.filter((entry) => matchesSearch(entry.searchText, query));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor={id} className="sr-only">
            {labels.label}
          </label>
          {/* `z-10` : avec le thème saisonnier, le champ (`.border`) passe en `relative`
              (globals.css) et se peindrait par-dessus l'icône. */}
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={id}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={labels.placeholder}
            autoComplete="off"
            spellCheck={false}
            className={`${FIELD_CLASS} pl-9`}
          />
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {countLabel(labels, shown.length, entries.length, filtering)}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-md border border-border p-4">
          {labels.none.replace("{query}", query.trim())}
        </p>
      ) : (
        <ul
          className={
            layout === "grid"
              ? "grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-2"
          }
        >
          {shown.map((entry) => (
            <li key={entry.id}>{entry.card}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
