/**
 * Schéma Zod des choix du thème saisonnier (§6.3 : toute entrée externe passe par Zod).
 * Importé en sens unique depuis `@/lib/seasonal-theme` (jamais l'inverse) pour éviter un cycle.
 */
import { z } from "zod";
import { SEASONAL_DENSITIES } from "@/lib/seasonal-theme";
import type { SeasonalChoice } from "@/lib/seasonal-theme";

/** « low » | « medium » | « high ». */
const seasonalDensitySchema = z.enum(SEASONAL_DENSITIES);

/** Interrupteur du bandeau et de la section : « on » | « off ». */
const seasonalToggleSchema = z.enum(["on", "off"]);

/**
 * Lit le formulaire : `seasonal` (`on` | `off`, obligatoire) et `density` (facultatif).
 * Renvoie `null` si une valeur est absente ou inconnue (formulaire forgé). La densité
 * absente (`null`) est conservée telle quelle (bandeau), une densité invalide est refusée.
 */
export function parseSeasonalForm(formData: FormData): SeasonalChoice | null {
  const toggle = seasonalToggleSchema.safeParse(formData.get("seasonal"));
  if (!toggle.success) {
    return null;
  }
  const enabled = toggle.data === "on";
  const rawDensity = formData.get("density");
  if (rawDensity === null) {
    return { enabled, density: null };
  }
  const density = seasonalDensitySchema.safeParse(rawDensity);
  if (!density.success) {
    return null;
  }
  return { enabled, density: density.data };
}
