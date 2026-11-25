/**
 * Formulaire des axes d'amélioration : lecture du FormData, validation Zod, écriture ;
 * valeurs de départ du formulaire. Ni Next.js ni authentification ici (§6.2).
 *
 * Champs HTML : un texte par axe, nommé comme l'axe (`mechanicsAk`, `decisionMaking`…).
 */
import { readText } from "@/lib/form-data";
import { IMPROVEMENT_AXES } from "@/lib/improvement-axes-fields";
import type { ImprovementAxis } from "@/lib/improvement-axes-fields";
import { improvementAxesSchema } from "@/lib/schemas/improvement-axes";
import type { ImprovementAxes } from "@/lib/schemas/improvement-axes";
import { saveImprovementAxes } from "../db/improvement-axes";
import type { Queryable } from "../db/users";

export type ImprovementAxesFormState =
  | { status: "idle" }
  /** Axes en erreur (texte trop long ou caractère interdit). */
  | { status: "invalid"; fields: readonly ImprovementAxis[] }
  | { status: "saved" };

/** Reconstruit l'objet attendu par `improvementAxesSchema` ; rien n'est validé ici. */
export function readImprovementAxesFormData(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(IMPROVEMENT_AXES.map((axis) => [axis, readText(formData, axis) ?? ""]));
}

function isAxis(value: unknown): value is ImprovementAxis {
  return IMPROVEMENT_AXES.some((axis) => axis === value);
}

/** Valide puis enregistre les axes d'amélioration de `userId`. */
export async function handleSaveImprovementAxes(
  db: Queryable,
  userId: string,
  formData: FormData,
): Promise<ImprovementAxesFormState> {
  const parsed = improvementAxesSchema.safeParse(readImprovementAxesFormData(formData));
  if (!parsed.success) {
    const fields = new Set<ImprovementAxis>();
    for (const issue of parsed.error.issues) {
      const [axis] = issue.path;
      if (isAxis(axis)) {
        fields.add(axis);
      }
    }
    return { status: "invalid", fields: [...fields] };
  }
  await saveImprovementAxes(db, { userId, axes: parsed.data });
  return { status: "saved" };
}

/** Valeurs de départ du formulaire : la fiche enregistrée, sinon des champs vides. */
export function improvementAxesFormValues(axes: ImprovementAxes | null): Record<string, string> {
  return Object.fromEntries(IMPROVEMENT_AXES.map((axis) => [axis, axes?.[axis] ?? ""]));
}
