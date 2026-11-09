"use client";

/**
 * Liste des collègues avec recherche instantanée (bloc 10) : nom, prénom ou club, sans
 * tenir compte des accents ni de la casse. Les cartes sont rendues par la page (serveur) ;
 * ce composant ne fait que les filtrer. Le nombre affiché est annoncé aux lecteurs d'écran.
 */
import { Search } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { FIELD_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { matchesSearch } from "./colleague-search";

const t = fr.colleagues.search;

export type DirectoryEntry = { id: string; searchText: string; card: ReactNode };

function countLabel(shown: number, total: number, filtering: boolean): string {
  const all = total === 1 ? t.countOne : t.countMany.replace("{count}", String(total));
  return filtering ? t.filtered.replace("{shown}", String(shown)).replace("{total}", all) : all;
}

export function ColleagueDirectory({ entries }: { entries: readonly DirectoryEntry[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const filtering = query.trim() !== "";
  const shown = entries.filter((entry) => matchesSearch(entry.searchText, query));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor={id} className="sr-only">
            {t.label}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={id}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={t.placeholder}
            autoComplete="off"
            spellCheck={false}
            className={`${FIELD_CLASS} pl-9`}
          />
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {countLabel(shown.length, entries.length, filtering)}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-md border border-border p-4">
          {t.none.replace("{query}", query.trim())}
        </p>
      ) : (
        <ul className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((entry) => (
            <li key={entry.id}>{entry.card}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
