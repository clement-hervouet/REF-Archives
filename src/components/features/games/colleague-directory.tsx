/**
 * Liste des collègues avec recherche instantanée (bloc 10) : nom, prénom ou club. Cartes
 * en grille ; la recherche elle-même est commune (`common/searchable-list.tsx`).
 */
import { SearchableList } from "@/components/features/common/searchable-list";
import type { SearchableEntry } from "@/components/features/common/searchable-list";
import { fr } from "@/i18n/fr";

export type DirectoryEntry = SearchableEntry;

export function ColleagueDirectory({ entries }: { entries: readonly DirectoryEntry[] }) {
  return <SearchableList entries={entries} labels={fr.colleagues.search} layout="grid" />;
}
