/**
 * Logique des formulaires de barème : lecture du FormData, validation Zod, appel SQL.
 * Ni Next.js ni authentification ici : la Server Action vérifie l'utilisateur (ou
 * l'admin pour le barème commun) AVANT d'appeler ces fonctions, puis leur passe le
 * propriétaire. Dépendances injectées : testable sans base.
 */
import type { z } from "zod";
import {
  addScaleRateFormSchema,
  createScaleFormSchema,
  levelDefaultFormSchema,
  renameScaleFormSchema,
  scaleIdFormSchema,
  scaleRateIdFormSchema,
} from "@/lib/schemas/scales";
import type { ScaleFormField } from "@/lib/schemas/scales";
import {
  clearLevelDefault,
  deleteScaleRate,
  deleteUserScale,
  insertScale,
  insertScaleRate,
  renameScale,
  upsertLevelDefault,
} from "../db/scales";
import type { DeleteRateResult, DeleteScaleResult, ScaleOwner } from "../db/scales";
import type { Queryable } from "../db/users";

/** Exécute `action` dans une transaction (COMMIT si elle réussit, ROLLBACK si elle lève). */
type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

export type ScaleDeps = {
  db: Queryable;
  transaction: Transaction;
};

/** État initial commun à tous les formulaires (`useActionState`). */
export type IdleState = { status: "idle" };

export type CreateScaleState =
  | IdleState
  | { status: "invalid"; fields: ScaleFormField[] }
  | { status: "name_taken" }
  | { status: "limit_reached" }
  | { status: "created"; scaleId: string };

export type AddRateState =
  | IdleState
  | { status: "invalid"; fields: ScaleFormField[] }
  | { status: "not_found" }
  | { status: "date_taken" }
  | { status: "limit_reached" }
  | { status: "added" };

export type RenameScaleState =
  | IdleState
  | { status: "invalid"; fields: ScaleFormField[] }
  | { status: "not_found" }
  | { status: "name_taken" }
  | { status: "renamed" };

export type DeleteRateState = IdleState | DeleteRateResult;

export type DeleteScaleState = IdleState | DeleteScaleResult;

export type LevelDefaultState =
  IdleState | { status: "invalid" } | { status: "not_found" } | { status: "saved" };

/** Lit les champs attendus ; une valeur absente ou un fichier sera refusé par Zod. */
function readFields(formData: FormData, names: readonly string[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const name of names) {
    fields[name] = formData.get(name);
  }
  return fields;
}

const FORM_FIELDS: readonly ScaleFormField[] = ["name", "effectiveFrom", "gameAmount", "ratePerKm"];

function isFormField(value: unknown): value is ScaleFormField {
  return FORM_FIELDS.some((field) => field === value);
}

/**
 * Champs en erreur, pour les signaler un par un (§7.4 : erreurs reliées aux champs).
 * Toujours dans l'ordre du formulaire, quel que soit l'ordre des erreurs de Zod.
 */
function invalidFields(error: z.ZodError): ScaleFormField[] {
  const failed = new Set<ScaleFormField>();
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (isFormField(field)) {
      failed.add(field);
    }
  }
  return FORM_FIELDS.filter((field) => failed.has(field));
}

/**
 * Crée un barème personnel et sa première ligne, ensemble : un barème a toujours un
 * montant de match et un taux km.
 */
export async function handleCreateScale(
  deps: ScaleDeps,
  userId: string,
  formData: FormData,
): Promise<CreateScaleState> {
  const parsed = createScaleFormSchema.safeParse(
    readFields(formData, ["name", "effectiveFrom", "gameAmount", "ratePerKm"]),
  );
  if (!parsed.success) {
    return { status: "invalid", fields: invalidFields(parsed.error) };
  }
  const input = parsed.data;
  return deps.transaction(async (db) => {
    const created = await insertScale(db, { userId, name: input.name });
    if (created.status !== "created") {
      return created;
    }
    // Barème neuf : la ligne ne peut être ni en doublon, ni hors limite.
    await insertScaleRate(db, {
      scaleId: created.scaleId,
      owner: { kind: "user", userId },
      effectiveFrom: input.effectiveFrom,
      gameAmountCents: input.gameAmount,
      centsPerKm: input.ratePerKm,
    });
    return created;
  });
}

/** Ajoute une ligne datée à un barème du propriétaire. */
export async function handleAddRate(
  deps: ScaleDeps,
  owner: ScaleOwner,
  formData: FormData,
): Promise<AddRateState> {
  const parsed = addScaleRateFormSchema.safeParse(
    readFields(formData, ["scaleId", "effectiveFrom", "gameAmount", "ratePerKm"]),
  );
  if (!parsed.success) {
    return { status: "invalid", fields: invalidFields(parsed.error) };
  }
  const result = await insertScaleRate(deps.db, {
    scaleId: parsed.data.scaleId,
    owner,
    effectiveFrom: parsed.data.effectiveFrom,
    gameAmountCents: parsed.data.gameAmount,
    centsPerKm: parsed.data.ratePerKm,
  });
  return result.status === "added" ? { status: "added" } : result;
}

/** Renomme un barème du propriétaire. */
export async function handleRenameScale(
  deps: ScaleDeps,
  owner: ScaleOwner,
  formData: FormData,
): Promise<RenameScaleState> {
  const parsed = renameScaleFormSchema.safeParse(readFields(formData, ["scaleId", "name"]));
  if (!parsed.success) {
    return { status: "invalid", fields: invalidFields(parsed.error) };
  }
  return renameScale(deps.db, { scaleId: parsed.data.scaleId, owner, name: parsed.data.name });
}

/** Supprime une ligne si aucune indemnité ne l'utilise et si ce n'est pas la dernière. */
export async function handleDeleteRate(
  deps: ScaleDeps,
  owner: ScaleOwner,
  formData: FormData,
): Promise<DeleteRateState> {
  const parsed = scaleRateIdFormSchema.safeParse(readFields(formData, ["rateId"]));
  if (!parsed.success) {
    return { status: "not_found" };
  }
  const rateId = parsed.data.rateId;
  return deps.transaction((db) => deleteScaleRate(db, { rateId, owner }));
}

/** Supprime (ou archive s'il est utilisé) un barème personnel. Jamais le barème commun. */
export async function handleDeleteScale(
  deps: ScaleDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteScaleState> {
  const parsed = scaleIdFormSchema.safeParse(readFields(formData, ["scaleId"]));
  if (!parsed.success) {
    return { status: "not_found" };
  }
  const scaleId = parsed.data.scaleId;
  return deps.transaction((db) => deleteUserScale(db, { scaleId, userId }));
}

/** Choisit le barème par défaut d'un niveau ; une valeur vide revient au barème commun. */
export async function handleSetLevelDefault(
  deps: ScaleDeps,
  userId: string,
  formData: FormData,
): Promise<LevelDefaultState> {
  const parsed = levelDefaultFormSchema.safeParse(readFields(formData, ["divisionId", "scaleId"]));
  if (!parsed.success) {
    return { status: "invalid" };
  }
  const { divisionId, scaleId } = parsed.data;
  if (scaleId === "") {
    await clearLevelDefault(deps.db, { userId, divisionId });
    return { status: "saved" };
  }
  const saved = await upsertLevelDefault(deps.db, { userId, divisionId, scaleId });
  return saved ? { status: "saved" } : { status: "not_found" };
}
