/**
 * Axes d'amélioration (§6.3) : un texte libre par axe, tous facultatifs. Une fiche vide est
 * acceptée : elle efface tout.
 */
import { z } from "zod";
import type { ImprovementAxis } from "@/lib/improvement-axes-fields";
import { noteBodySchema } from "./notes";

/**
 * Texte libre, multiligne, 4 096 caractères au plus, sans caractère de contrôle (hors saut
 * de ligne et tabulation) : mêmes règles que le texte de la note. Vide → `null`.
 */
const axisTextSchema = noteBodySchema;

export const improvementAxesSchema = z.object({
  mechanicsAk: axisTextSchema,
  mechanicsAt: axisTextSchema,
  mechanicsTransitions: axisTextSchema,
  decisionMaking: axisTextSchema,
  signals: axisTextSchema,
  foulJudgment: axisTextSchema,
  violationJudgment: axisTextSchema,
} satisfies Record<ImprovementAxis, typeof axisTextSchema>);

export type ImprovementAxes = z.output<typeof improvementAxesSchema>;
