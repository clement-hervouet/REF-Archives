/**
 * Lien d'un club avec l'annuaire FFBB : son identifiant, l'UUID de son logo et sa couleur
 * (fond de la pastille). Arrive dans un champ caché (JSON) quand le club est choisi dans
 * l'annuaire, ou par l'action « Lier à l'annuaire FFBB » de l'onglet « Clubs ».
 *
 * L'utilisateur ne voit pas ce champ et ne peut pas le corriger : un lien illisible est
 * abandonné (`null`) au lieu de refuser tout le formulaire. Les valeurs venant du
 * navigateur, l'UUID et la couleur sont validés strictement : le logo n'est jamais
 * téléchargé ailleurs que sur `api.ffbb.com/assets/<uuid>`.
 */
import { z } from "zod";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const ffbbIdSchema = z.string().regex(/^\d{1,20}$/);

export const ffbbLinkSchema = z.object({
  id: ffbbIdSchema,
  logoUuid: z.uuid().nullable(),
  color: z
    .string()
    .regex(HEX_COLOR)
    .transform((value) => value.toLowerCase())
    .nullable(),
});

export type FfbbClubLink = z.output<typeof ffbbLinkSchema>;

/** Champ caché facultatif : absent, vide ou illisible = pas de lien. */
export const optionalFfbbLinkSchema = ffbbLinkSchema.nullable().catch(null);
