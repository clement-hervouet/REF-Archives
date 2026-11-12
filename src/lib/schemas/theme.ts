/**
 * Schéma Zod du choix de thème (§6.3 : toute entrée externe passe par Zod).
 * Importé en sens unique depuis `@/lib/theme` (jamais l'inverse) pour éviter un cycle.
 */
import { z } from "zod";
import { THEME_PREFERENCES } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

/** « system » | « light » | « dark ». */
const themePreferenceSchema = z.enum(THEME_PREFERENCES);

/** Lit la préférence envoyée par le formulaire, ou `null` si absente ou inconnue. */
export function parseThemeForm(formData: FormData): ThemePreference | null {
  const parsed = themePreferenceSchema.safeParse(formData.get("theme"));
  return parsed.success ? parsed.data : null;
}
