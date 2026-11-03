/**
 * Schémas des formulaires de barème (§6.3). Les montants sont saisis en euros (virgule
 * ou point) et convertis ici en valeurs exactes : centimes entiers pour le match,
 * chaîne `numeric(6, 2)` en centimes par km pour le taux. Jamais de float.
 */
import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

/** Bornes raisonnables pour une date d'application (dates passées autorisées). */
export const EFFECTIVE_FROM_MIN = "2000-01-01";
export const EFFECTIVE_FROM_MAX = "2100-12-31";

/** Montant de match : jusqu'à 99 999,99 €, au plus deux décimales. */
const EURO_AMOUNT_PATTERN = /^(\d{1,5})(?:[.,](\d{1,2}))?$/;
/** Taux km : jusqu'à 99,9999 €/km, au plus quatre décimales (0,425 € par exemple). */
const EURO_PER_KM_PATTERN = /^(\d{1,2})(?:[.,](\d{1,4}))?$/;
/** Aucun caractère de contrôle (sauts de ligne, tabulations, NUL…). */
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;

/** « 45,5 » → 4550 centimes. Suppose une chaîne déjà validée par le motif. */
function eurosToCents(value: string): number {
  const [whole = "0", fraction = ""] = value.split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** « 0,425 » € par km → « 42.50 » centimes par km. Suppose une chaîne déjà validée. */
function eurosPerKmToCentsPerKm(value: string): string {
  const [whole = "0", fraction = ""] = value.split(/[.,]/);
  // Valeur entière en dix-millièmes d'euro = centièmes de centime.
  const hundredthsOfCent = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
  const cents = Math.floor(hundredthsOfCent / 100);
  const rest = String(hundredthsOfCent % 100).padStart(2, "0");
  return `${String(cents)}.${rest}`;
}

export const scaleNameSchema = z.string().trim().min(1).max(100).regex(NO_CONTROL_CHARS);

export const effectiveFromSchema = z
  .string()
  .trim()
  .refine(isIsoDate)
  .refine((value) => value >= EFFECTIVE_FROM_MIN && value <= EFFECTIVE_FROM_MAX);

export const gameAmountSchema = z
  .string()
  .trim()
  .regex(EURO_AMOUNT_PATTERN)
  .transform(eurosToCents);

export const ratePerKmSchema = z
  .string()
  .trim()
  .regex(EURO_PER_KM_PATTERN)
  .transform(eurosPerKmToCentsPerKm);

/** Champs d'une ligne de barème (montant de match + taux km, datés). */
export const scaleRateFormSchema = z.object({
  effectiveFrom: effectiveFromSchema,
  gameAmount: gameAmountSchema,
  ratePerKm: ratePerKmSchema,
});

/** Création d'un barème personnel : il a forcément une première ligne. */
export const createScaleFormSchema = scaleRateFormSchema.extend({ name: scaleNameSchema });

export const addScaleRateFormSchema = scaleRateFormSchema.extend({ scaleId: z.uuid() });

export const renameScaleFormSchema = z.object({ scaleId: z.uuid(), name: scaleNameSchema });

export const scaleIdFormSchema = z.object({ scaleId: z.uuid() });

export const scaleRateIdFormSchema = z.object({ rateId: z.uuid() });

/** Barème par défaut d'un niveau ; une valeur vide revient au barème commun. */
export const levelDefaultFormSchema = z.object({
  divisionId: z.uuid(),
  scaleId: z.union([z.literal(""), z.uuid()]),
});

/** Champs d'un formulaire de ligne, pour signaler précisément ceux qui sont invalides. */
export type ScaleFormField = "name" | "effectiveFrom" | "gameAmount" | "ratePerKm";