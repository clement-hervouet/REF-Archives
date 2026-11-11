/**
 * Schéma du formulaire d'indemnité (bloc 6, §6.3). La Server Action reconstruit cet objet
 * depuis le FormData, puis tout passe ici avant la moindre requête.
 *
 * Une indemnité est autonome : elle porte elle-même les informations du match indemnisé,
 * sans référence obligatoire à un match complet (arbitres, notes : bloc ultérieur).
 * - équipes : un club existant (par identifiant) ou un nouveau, créé à la volée ;
 * - adresse : celle du club de l'équipe 1 par défaut, une autre seulement en cas
 *   d'exception (case à cocher) ;
 * - distance : saisie en km aller, stockée en mètres aller-retour (×2).
 */
import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { MAX_ONE_WAY_DISTANCE_M, ONE_WAY_KM_PATTERN, oneWayKmToMeters } from "@/lib/distance";
import { ValidationError } from "@/lib/errors";
import { isTimeOfDay, parisLocalToUtc } from "@/lib/paris-time";
import { parsePayerKey } from "@/lib/payers";

/** Bornes raisonnables pour la date d'un match. */
const MATCH_DATE_MIN = "2000-01-01";
const MATCH_DATE_MAX = "2100-12-31";

/** Aucun caractère de contrôle (sauts de ligne, tabulations, NUL…). */
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;
/** Code postal générique (France et étranger) : lettres, chiffres, espace, tiret. */
const POSTAL_CODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z -]{1,9}$/;

const requiredText = (max: number) => z.string().trim().min(1).max(max).regex(NO_CONTROL_CHARS);

/** Champ texte facultatif : une saisie vide devient `null` (colonne NULL). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(NO_CONTROL_CHARS)
    .transform((value) => (value === "" ? null : value));

/** Km aller saisis → mètres aller-retour. */
export const oneWayDistanceSchema = z
  .string()
  .trim()
  .regex(ONE_WAY_KM_PATTERN)
  .transform(oneWayKmToMeters)
  .refine((meters) => meters <= MAX_ONE_WAY_DISTANCE_M)
  .transform((meters) => meters * 2);

export const newAddressSchema = z.object({
  street: requiredText(255),
  number: optionalText(20),
  postalCode: z.string().trim().regex(POSTAL_CODE_PATTERN),
  city: requiredText(255),
  country: optionalText(100),
});

/**
 * Équipe : désignée par son club. L'équipe elle-même (club + niveau du match) est
 * retrouvée ou créée côté serveur.
 */
export const teamChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), clubId: z.uuid() }),
  z.object({ kind: z.literal("new"), name: requiredText(255), address: newAddressSchema }),
]);

/**
 * Adresse du match : celle du club de l'équipe 1 (cas normal), ou une exception
 * (adresse déjà connue ou nouvelle).
 */
const venueChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("team1") }),
  z.object({ kind: z.literal("existing"), addressId: z.uuid() }),
  z.object({ kind: z.literal("new"), address: newAddressSchema }),
]);

/** Informations d'un match, communes à l'indemnité et au match complet (bloc 9). */
const matchFieldsShape = {
  date: z
    .string()
    .trim()
    .refine(isIsoDate)
    .refine((value) => value >= MATCH_DATE_MIN && value <= MATCH_DATE_MAX),
  time: z.string().trim().refine(isTimeOfDay),
  divisionId: z.uuid(),
  team1: teamChoiceSchema,
  team2: teamChoiceSchema,
  venue: venueChoiceSchema,
};

/**
 * Organisme qui verse (bloc 10) : vide = déduit automatiquement du niveau et de l'adresse
 * (`null`), sinon une clé connue (`cd-35`, `ligue-bretagne`, `federation`).
 */
const payerChoiceSchema = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : value))
  .refine((value) => value === null || parsePayerKey(value) !== null, {
    message: "invalid_payer",
  });

const compensationFieldsSchema = z.object({
  ...matchFieldsShape,
  scaleId: z.uuid(),
  payer: payerChoiceSchema,
  oneWayDistance: oneWayDistanceSchema,
});

const matchFieldsSchema = z.object(matchFieldsShape);

type MatchFieldsValue = z.output<typeof matchFieldsSchema>;

/** Règles croisées : deux clubs différents, heure qui existe ce jour-là à Paris. */
function refineMatchFields(value: MatchFieldsValue, ctx: z.RefinementCtx): void {
  if (
    value.team1.kind === "existing" &&
    value.team2.kind === "existing" &&
    value.team1.clubId === value.team2.clubId
  ) {
    ctx.addIssue({ code: "custom", path: ["team2"], message: "same_club" });
  }
  // Vérifiée ici aussi (et pas seulement dans le transform, que Zod saute dès qu'une
  // autre erreur existe) : toutes les erreurs remontent en un seul envoi. Seulement si
  // la date et l'heure sont valides séparément, sinon leurs propres erreurs suffisent.
  if (!isIsoDate(value.date) || !isTimeOfDay(value.time)) {
    return;
  }
  try {
    parisLocalToUtc(value.date, value.time);
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw error;
    }
    ctx.addIssue({ code: "custom", path: ["time"], message: error.message });
  }
}

/** Informations du match validées : `startsAt` (instant UTC) remplace date et heure. */
function toMatchInfo(value: MatchFieldsValue, ctx: z.RefinementCtx) {
  let startsAt: Date;
  try {
    startsAt = parisLocalToUtc(value.date, value.time);
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw error;
    }
    ctx.addIssue({ code: "custom", path: ["time"], message: error.message });
    return z.NEVER;
  }
  return {
    startsAt,
    divisionId: value.divisionId,
    team1: value.team1,
    team2: value.team2,
    venue: value.venue,
  };
}

/**
 * Formulaire complet. Après validation : `startsAt` (instant UTC) et `distanceM` (mètres
 * aller-retour) remplacent la saisie brute.
 */
export const compensationFormSchema = compensationFieldsSchema
  .superRefine(refineMatchFields)
  .transform((value, ctx) => {
    const info = toMatchInfo(value, ctx);
    return {
      ...info,
      scaleId: value.scaleId,
      payer: value.payer,
      distanceM: value.oneWayDistance,
    };
  });

/**
 * Informations d'un match complet sans indemnité, ou modifiées depuis sa fiche (bloc 9) :
 * mêmes champs et mêmes règles que l'indemnité, sans barème ni distance.
 */
export const matchInfoFormSchema = matchFieldsSchema
  .superRefine(refineMatchFields)
  .transform(toMatchInfo);

export type MatchInfo = z.output<typeof matchInfoFormSchema>;

export type CompensationFormInput = z.input<typeof compensationFormSchema>;
export type CompensationForm = z.output<typeof compensationFormSchema>;
