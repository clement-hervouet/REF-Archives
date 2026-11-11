/**
 * Schémas du flux iCal (§6.3) :
 * - nom de fichier du flux : `<jeton>.ics`, où le jeton fait 43 caractères base64url
 *   (256 bits, voir `src/server/auth/tokens.ts`). Tout autre format est refusé avant le
 *   moindre accès à la base ;
 * - intention du formulaire de gestion du lien (créer/régénérer ou révoquer).
 */
import { z } from "zod";

const FEED_FILE_PATTERN = /^([A-Za-z0-9_-]{43})\.ics$/;

const calendarFeedFileSchema = z
  .string()
  .regex(FEED_FILE_PATTERN)
  .transform((file) => file.slice(0, -".ics".length));

/** Jeton contenu dans le nom de fichier, ou `null` s'il est mal formé. */
export function parseCalendarFeedFile(file: string): string | null {
  const result = calendarFeedFileSchema.safeParse(file);
  return result.success ? result.data : null;
}

/** `create` crée le lien ou le remplace (régénération) ; `revoke` le supprime. */
const calendarFeedIntentSchema = z.enum(["create", "revoke"]);
export type CalendarFeedIntent = z.infer<typeof calendarFeedIntentSchema>;

/** Intention envoyée par le formulaire, ou `null` si elle est absente ou inconnue. */
export function parseCalendarFeedIntent(formData: FormData): CalendarFeedIntent | null {
  const result = calendarFeedIntentSchema.safeParse(formData.get("intent"));
  return result.success ? result.data : null;
}
