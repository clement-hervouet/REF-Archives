/**
 * Liste des axes d'amélioration d'un utilisateur, dans son ordre, à partir des lignes
 * enregistrées : axes par défaut et catégories personnelles. Pur et sans dépendance à la
 * base : testé à part.
 *
 * Seuls les axes visibles sont affichés et rangés ; les axes par défaut masqués (supprimés)
 * restent en fin de liste, pour pouvoir être rétablis.
 */
import { IMPROVEMENT_AXES } from "@/lib/improvement-axes-fields";
import type { ImprovementAxis, ImprovementAxisItem } from "@/lib/improvement-axes-fields";

/** Une ligne de `improvement_axis`, telle que lue par `src/server/db/improvement-axes.ts`. */
export type ImprovementAxisRow = {
  id: string;
  position: number;
  body: string | null;
} & (
  | { defaultKey: ImprovementAxis; label: null; hidden: boolean }
  | { defaultKey: null; label: string; hidden: false }
);

type DefaultItem = Extract<ImprovementAxisItem, { defaultKey: ImprovementAxis }>;
type CustomItem = Extract<ImprovementAxisItem, { defaultKey: null }>;

function itemOf(row: ImprovementAxisRow): ImprovementAxisItem {
  return row.defaultKey === null
    ? { slot: row.id, defaultKey: null, label: row.label, body: row.body, hidden: false }
    : {
        slot: row.defaultKey,
        defaultKey: row.defaultKey,
        label: null,
        body: row.body,
        hidden: row.hidden,
      };
}

/**
 * Les axes enregistrés dans leur ordre, puis chaque axe par défaut sans ligne (aucun
 * enregistrement encore, ou axe ajouté depuis), texte vide, dans l'ordre par défaut.
 */
export function buildAxisList(rows: readonly ImprovementAxisRow[]): ImprovementAxisItem[] {
  const saved = [...rows].sort((a, b) => a.position - b.position).map(itemOf);
  const missing = IMPROVEMENT_AXES.filter((key) => !rows.some((row) => row.defaultKey === key)).map(
    (key): ImprovementAxisItem => ({
      slot: key,
      defaultKey: key,
      label: null,
      body: null,
      hidden: false,
    }),
  );
  return [...saved, ...missing];
}

/** Les axes affichés, dans leur ordre. */
export function visibleAxes(list: readonly ImprovementAxisItem[]): ImprovementAxisItem[] {
  return list.filter((item) => !item.hidden);
}

/** Les axes par défaut supprimés, à rétablir. */
export function hiddenAxes(list: readonly ImprovementAxisItem[]): DefaultItem[] {
  return list.filter((item): item is DefaultItem => item.hidden);
}

/**
 * La liste rangée selon `slots` (axes visibles), les axes masqués à la suite, ou `null` si
 * `slots` ne reprend pas exactement chaque axe visible une fois (formulaire périmé : un axe
 * ajouté, supprimé ou rétabli entre-temps).
 */
export function reorderAxisList(
  list: readonly ImprovementAxisItem[],
  slots: readonly string[],
): ImprovementAxisItem[] | null {
  const visible = visibleAxes(list);
  if (slots.length !== visible.length || new Set(slots).size !== slots.length) {
    return null;
  }
  const reordered: ImprovementAxisItem[] = [];
  for (const slot of slots) {
    const item = visible.find((candidate) => candidate.slot === slot);
    if (item === undefined) {
      return null;
    }
    reordered.push(item);
  }
  return [...reordered, ...hiddenAxes(list)];
}

/**
 * La liste sans l'axe visible `slot` : une catégorie personnelle disparaît, un axe par défaut
 * passe masqué, texte effacé, en fin de liste. `null` si `slot` n'est pas un axe visible.
 */
export function removeAxis(
  list: readonly ImprovementAxisItem[],
  slot: string,
): { list: ImprovementAxisItem[]; removed: ImprovementAxisItem } | null {
  const removed = visibleAxes(list).find((item) => item.slot === slot);
  if (removed === undefined) {
    return null;
  }
  const rest = list.filter((item) => item !== removed);
  if (removed.defaultKey === null) {
    return { list: rest, removed };
  }
  const hidden: ImprovementAxisItem = { ...removed, body: null, hidden: true };
  return { list: [...visibleAxes(rest), hidden, ...hiddenAxes(rest)], removed };
}

/**
 * La liste avec l'axe par défaut masqué `slot` rétabli, texte vide, à la fin des axes
 * visibles. `null` si `slot` n'est pas un axe masqué.
 */
export function restoreAxis(
  list: readonly ImprovementAxisItem[],
  slot: string,
): ImprovementAxisItem[] | null {
  const restored = hiddenAxes(list).find((item) => item.slot === slot);
  if (restored === undefined) {
    return null;
  }
  return [
    ...visibleAxes(list),
    { ...restored, hidden: false },
    ...hiddenAxes(list).filter((item) => item !== restored),
  ];
}

/** La catégorie personnelle `slot` de la liste, ou `undefined` (axe par défaut, inconnu). */
export function findCustomAxis(
  list: readonly ImprovementAxisItem[],
  slot: string,
): CustomItem | undefined {
  return list.find((item): item is CustomItem => item.defaultKey === null && item.slot === slot);
}

/** Comparaison des noms : sans tenir compte de la casse, comme l'index unique en base. */
export function sameLabel(a: string, b: string): boolean {
  return a.toLocaleLowerCase("fr") === b.toLocaleLowerCase("fr");
}
