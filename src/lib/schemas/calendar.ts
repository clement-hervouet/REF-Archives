/**
 * Schéma du nom de fichier du flux iCal (§6.3) : `<jeton>.ics`, où le jeton fait
 * 43 caractères base64url (256 bits, voir `src/server/auth/tokens.ts`).
 * Tout autre format est refusé avant le moindre accès à la base.
 */
import { z } from "zod";

const FEED_FILE_PATTERN = /^([A-Za-z0-9_-]{43})\.ics$/;

export const calendarFeedFileSchema = z
  .string()
  .regex(FEED_FILE_PATTERN)
  .transform((file) => file.slice(0, -".ics".length));

/** Jeton contenu dans le nom de fichier, ou `null` s'il est mal formé. */
export function parseCalendarFeedFile(file: string): string | null {
  const result = calendarFeedFileSchema.safeParse(file);
  return result.success ? result.data : null;
}
