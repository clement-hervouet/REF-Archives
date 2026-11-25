/**
 * Schéma de la fiche d'un club (onglet « Clubs », §15.4.1). Nom et code postal
 * obligatoires, comme à la création depuis une indemnité ; nom de la salle principale, rue,
 * numéro, ville et pays facultatifs, à compléter quand on les connaît. Une saisie vide
 * devient `null`. Le nom est enregistré en majuscules. À l'ajout, les autres salles
 * importées de l'annuaire FFBB arrivent en liste (`venues`).
 */
import { z } from "zod";
import { clubNameSchema, clubVenuesSchema, optionalText, postalCodeSchema } from "./compensations";

export const clubFormSchema = z.object({
  name: clubNameSchema,
  venueName: optionalText(255),
  street: optionalText(255),
  number: optionalText(20),
  postalCode: postalCodeSchema,
  city: optionalText(255),
  country: optionalText(100),
  venues: clubVenuesSchema,
});

export type ClubFormValue = z.output<typeof clubFormSchema>;

/** Champs du formulaire, dans l'ordre d'affichage (erreurs reliées au champ, §7.4). */
export const CLUB_FIELDS = [
  "name",
  "venueName",
  "street",
  "number",
  "postalCode",
  "city",
  "country",
  "venues",
] as const;

export type ClubField = (typeof CLUB_FIELDS)[number];
