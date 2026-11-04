/**
 * Traduit le `status` renvoyé par une action de barème en message affichable.
 * Pur et sans React : testé à part. Les erreurs de champ sont gérées par `fieldError`.
 */
import { fr } from "@/i18n/fr";
import type { ScaleFormField } from "@/lib/schemas/scales";

const t = fr.scales;

export type ScaleMessage = { tone: "error" | "success"; text: string };

/** Tous les statuts possibles des actions de barème (voir `manage-scales.ts`). */
export type ScaleStatus =
  | "idle"
  | "invalid"
  | "created"
  | "added"
  | "renamed"
  | "deleted"
  | "archived"
  | "saved"
  | "name_taken"
  | "date_taken"
  | "limit_reached"
  | "not_found"
  | "in_use"
  | "last_rate";

/**
 * Message global d'un formulaire. `invalid` n'a pas de message global quand des champs
 * précis sont en cause : chaque champ affiche alors le sien.
 */
export function scaleStatusMessage(
  status: ScaleStatus,
  context: { invalidFields?: readonly ScaleFormField[]; limit?: "scale" | "rate" } = {},
): ScaleMessage | null {
  switch (status) {
    case "idle":
      return null;
    case "invalid":
      return (context.invalidFields ?? []).length > 0
        ? null
        : { tone: "error", text: t.errors.invalid };
    case "created":
      return { tone: "success", text: t.create.created };
    case "added":
      return { tone: "success", text: t.addRate.added };
    case "renamed":
      return { tone: "success", text: t.rename.renamed };
    case "deleted":
      return { tone: "success", text: t.deleteRate.deleted };
    case "archived":
      return { tone: "success", text: t.deleteScale.archived };
    case "saved":
      return { tone: "success", text: t.defaults.saved };
    case "name_taken":
      return { tone: "error", text: t.errors.nameTaken };
    case "date_taken":
      return { tone: "error", text: t.errors.dateTaken };
    case "limit_reached":
      return {
        tone: "error",
        text: context.limit === "rate" ? t.errors.rateLimit : t.errors.scaleLimit,
      };
    case "not_found":
      return { tone: "error", text: t.errors.notFound };
    case "in_use":
      return { tone: "error", text: t.errors.rateInUse };
    case "last_rate":
      return { tone: "error", text: t.errors.lastRate };
  }
}

/** Message d'erreur d'un champ précis, ou `null` s'il est valide. */
export function fieldError(
  field: ScaleFormField,
  invalidFields: readonly ScaleFormField[],
): string | null {
  return invalidFields.includes(field) ? t.errors[field] : null;
}