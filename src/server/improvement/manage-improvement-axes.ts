/**
 * Formulaires des axes d'amélioration : textes, ordre, catégories personnelles (ajout,
 * renommage), suppression de toute catégorie et rétablissement d'un axe par défaut supprimé. Lecture du FormData, validation Zod, écriture. Ni Next.js ni
 * authentification ici (§6.2).
 *
 * Chaque écriture se fait dans une transaction, verrou pris : la liste est relue puis
 * réécrite entière (positions comprises), sans croiser un autre enregistrement.
 *
 * Champs HTML : un texte par axe, nommé par son `slot` ; l'ordre est la liste des `slot`
 * (champ `order` répété), du premier au dernier ; une catégorie est désignée par `slot` et
 * nommée par `label`.
 */
import { fr } from "@/i18n/fr";
import { IMPROVEMENT_AXES, IMPROVEMENT_CUSTOM_MAX } from "@/lib/improvement-axes-fields";
import type { ImprovementAxisItem } from "@/lib/improvement-axes-fields";
import { readText } from "@/lib/form-data";
import { axisLabelSchema, axisOrderSchema, axisTextSchema } from "@/lib/schemas/improvement-axes";
import {
  deleteCustomImprovementAxis,
  findImprovementAxes,
  insertCustomImprovementAxis,
  lockImprovementAxes,
  renameCustomImprovementAxis,
  writeImprovementAxes,
} from "../db/improvement-axes";
import type { Queryable, Transaction } from "../db/users";
import {
  buildAxisList,
  findCustomAxis,
  removeAxis,
  reorderAxisList,
  restoreAxis,
  sameLabel,
} from "./axis-list";

export type ImprovementAxesDeps = { transaction: Transaction };

export type ImprovementAxesFormState =
  | { status: "idle" }
  /** Axes en erreur (`slot`) : texte trop long ou caractère interdit. */
  | { status: "invalid"; fields: readonly string[] }
  | { status: "saved" };

export type ReorderImprovementAxesState =
  | { status: "idle" }
  | { status: "reordered" }
  /** L'ordre envoyé ne reprend pas les axes actuels : la page doit être relue. */
  | { status: "stale" };

/** Nom refusé : vide, trop long, caractère interdit, ou déjà pris (axe ou catégorie). */
export type AxisLabelError = "required" | "too_long" | "invalid" | "duplicate";

export type CreateImprovementAxisState =
  | { status: "idle" }
  | { status: "created" }
  | { status: "invalid"; error: AxisLabelError }
  /** `IMPROVEMENT_CUSTOM_MAX` catégories personnelles déjà. */
  | { status: "limit" };

export type RenameImprovementAxisState =
  | { status: "idle" }
  | { status: "renamed" }
  | { status: "invalid"; error: AxisLabelError }
  /** Catégorie supprimée entre-temps, ou axe par défaut (jamais renommé). */
  | { status: "notFound" };

export type DeleteImprovementAxisState =
  | { status: "idle" }
  | { status: "deleted" }
  /** Catégorie déjà supprimée (autre onglet) ou inconnue. */
  | { status: "notFound" };

export type RestoreImprovementAxisState =
  | { status: "idle" }
  | { status: "restored" }
  /** Axe déjà rétabli (autre onglet), ou qui n'est pas un axe par défaut supprimé. */
  | { status: "notFound" };

async function lockedAxisList(db: Queryable, userId: string): Promise<ImprovementAxisItem[]> {
  await lockImprovementAxes(db, userId);
  const { rows } = await findImprovementAxes(db, userId);
  return buildAxisList(rows);
}

/**
 * Valide puis enregistre les textes des axes de `userId`. Seuls les axes visibles présents
 * dans le formulaire changent : un formulaire ouvert avant l'ajout d'un axe ne l'efface pas,
 * et un axe supprimé entre-temps n'en reçoit pas.
 */
export async function handleSaveImprovementAxes(
  deps: ImprovementAxesDeps,
  userId: string,
  formData: FormData,
): Promise<ImprovementAxesFormState> {
  return deps.transaction(async (db) => {
    const list = await lockedAxisList(db, userId);
    const invalid: string[] = [];
    const updated = list.map((item) => {
      const value = formData.get(item.slot);
      if (item.hidden || typeof value !== "string") {
        return item;
      }
      const parsed = axisTextSchema.safeParse(value);
      if (!parsed.success) {
        invalid.push(item.slot);
        return item;
      }
      return { ...item, body: parsed.data };
    });
    if (invalid.length > 0) {
      return { status: "invalid", fields: invalid };
    }
    await writeImprovementAxes(db, userId, updated);
    return { status: "saved" };
  });
}

/** Range les axes de `userId` dans l'ordre envoyé (textes inchangés). */
export async function handleReorderImprovementAxes(
  deps: ImprovementAxesDeps,
  userId: string,
  formData: FormData,
): Promise<ReorderImprovementAxesState> {
  const order = axisOrderSchema.safeParse(formData.getAll("order"));
  if (!order.success) {
    return { status: "stale" };
  }
  return deps.transaction(async (db) => {
    const reordered = reorderAxisList(await lockedAxisList(db, userId), order.data);
    if (reordered === null) {
      return { status: "stale" };
    }
    await writeImprovementAxes(db, userId, reordered);
    return { status: "reordered" };
  });
}

/** Nom affiché de chaque axe par défaut : une catégorie ne peut pas en reprendre un. */
const DEFAULT_LABELS = IMPROVEMENT_AXES.map((key) => fr.improvementAxes.axes[key]);

function parseLabel(
  formData: FormData,
): { success: true; label: string } | { success: false; error: AxisLabelError } {
  const parsed = axisLabelSchema.safeParse(readText(formData, "label") ?? "");
  if (parsed.success) {
    return { success: true, label: parsed.data };
  }
  const code = parsed.error.issues[0]?.message;
  return { success: false, error: code === "too_long" || code === "invalid" ? code : "required" };
}

/** Le nom est-il déjà pris, par un axe par défaut ou une autre catégorie que `exceptSlot` ? */
function isLabelTaken(
  list: readonly ImprovementAxisItem[],
  label: string,
  exceptSlot: string | null = null,
): boolean {
  return (
    DEFAULT_LABELS.some((taken) => sameLabel(taken, label)) ||
    list.some(
      (item) => item.label !== null && item.slot !== exceptSlot && sameLabel(item.label, label),
    )
  );
}

/** Ajoute une catégorie personnelle en fin de liste, texte vide. */
export async function handleCreateImprovementAxis(
  deps: ImprovementAxesDeps,
  userId: string,
  formData: FormData,
): Promise<CreateImprovementAxisState> {
  const parsed = parseLabel(formData);
  if (!parsed.success) {
    return { status: "invalid", error: parsed.error };
  }
  return deps.transaction(async (db) => {
    const list = await lockedAxisList(db, userId);
    if (list.filter((item) => item.defaultKey === null).length >= IMPROVEMENT_CUSTOM_MAX) {
      return { status: "limit" };
    }
    if (isLabelTaken(list, parsed.label)) {
      return { status: "invalid", error: "duplicate" };
    }
    // Les axes par défaut jamais enregistrés reçoivent leur ligne d'abord : la nouvelle
    // catégorie se range bien après eux.
    await writeImprovementAxes(db, userId, list);
    await insertCustomImprovementAxis(db, { userId, label: parsed.label, position: list.length });
    return { status: "created" };
  });
}

/** Renomme une catégorie personnelle ; les axes par défaut gardent leur nom. */
export async function handleRenameImprovementAxis(
  deps: ImprovementAxesDeps,
  userId: string,
  formData: FormData,
): Promise<RenameImprovementAxisState> {
  const slot = readText(formData, "slot") ?? "";
  const parsed = parseLabel(formData);
  if (!parsed.success) {
    return { status: "invalid", error: parsed.error };
  }
  return deps.transaction(async (db) => {
    const list = await lockedAxisList(db, userId);
    const axis = findCustomAxis(list, slot);
    if (axis === undefined) {
      return { status: "notFound" };
    }
    if (isLabelTaken(list, parsed.label, slot)) {
      return { status: "invalid", error: "duplicate" };
    }
    if (axis.label !== parsed.label) {
      await renameCustomImprovementAxis(db, { userId, id: axis.slot, label: parsed.label });
    }
    return { status: "renamed" };
  });
}

/**
 * Supprime une catégorie et son texte : une catégorie personnelle disparaît, un axe par
 * défaut est masqué (il pourra être rétabli). Les suivantes remontent d'un rang.
 */
export async function handleDeleteImprovementAxis(
  deps: ImprovementAxesDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteImprovementAxisState> {
  const slot = readText(formData, "slot") ?? "";
  return deps.transaction(async (db) => {
    const result = removeAxis(await lockedAxisList(db, userId), slot);
    if (result === null) {
      return { status: "notFound" };
    }
    if (result.removed.defaultKey === null) {
      await deleteCustomImprovementAxis(db, { userId, id: result.removed.slot });
    }
    await writeImprovementAxes(db, userId, result.list);
    return { status: "deleted" };
  });
}

/** Rétablit un axe par défaut supprimé, texte vide, en fin de liste. */
export async function handleRestoreImprovementAxis(
  deps: ImprovementAxesDeps,
  userId: string,
  formData: FormData,
): Promise<RestoreImprovementAxisState> {
  const slot = readText(formData, "slot") ?? "";
  return deps.transaction(async (db) => {
    const list = restoreAxis(await lockedAxisList(db, userId), slot);
    if (list === null) {
      return { status: "notFound" };
    }
    await writeImprovementAxes(db, userId, list);
    return { status: "restored" };
  });
}

/** Valeurs de départ du formulaire des textes : un texte par axe (`slot`), vide sinon. */
export function improvementAxesFormValues(
  list: readonly ImprovementAxisItem[],
): Record<string, string> {
  return Object.fromEntries(list.map((item) => [item.slot, item.body ?? ""]));
}
