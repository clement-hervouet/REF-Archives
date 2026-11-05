/**
 * Schéma d'un email sortant (CLAUDE.md §6.3, §6.6).
 * Imports sans alias : ce fichier est aussi chargé par un script Node.
 */
import { z } from "zod";

/** Interdit tout saut de ligne : empêche l'injection d'en-têtes dans le sujet. */
const SINGLE_LINE = /^[^\r\n]*$/;

export const EmailMessageSchema = z.object({
  to: z.email().max(254),
  subject: z.string().min(1).max(200).regex(SINGLE_LINE, "ne doit pas contenir de saut de ligne"),
  text: z.string().min(1).max(50_000),
  html: z.string().min(1).max(200_000).optional(),
});

export type EmailMessage = z.infer<typeof EmailMessageSchema>;
