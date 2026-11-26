/**
 * Axes d'amélioration (§6.3) : un texte libre par axe, tous facultatifs. Une fiche vide est
 * acceptée : elle efface tout.
 */
import { z } from "zod";
import { IMPROVEMENT_LABEL_MAX } from "@/lib/improvement-axes-fields";
import { noteBodySchema } from "./notes";

/**
 * Texte libre, multiligne, 4 096 caractères au plus, sans caractère de contrôle (hors saut
 * de ligne et tabulation) : mêmes règles que le texte de la note. Vide → `null`.
 */
export const axisTextSchema = noteBodySchema;

/** Ordre envoyé par le formulaire : la liste des axes (`slot`), du premier au dernier. */
export const axisOrderSchema = z.array(z.string().min(1).max(64)).min(1).max(100);

/**
 * Nom d'une catégorie personnelle : espaces regroupés et retirés aux extrémités, sans
 * caractère de contrôle. Codes d'erreur : `required`, `too_long`, `invalid`.
 */
export const axisLabelSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "required")
      .max(IMPROVEMENT_LABEL_MAX, "too_long")
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "invalid"),
  );
