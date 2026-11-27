/**
 * Schéma du formulaire d'indemnité (bloc 6, §6.3). La Server Action reconstruit cet objet
 * depuis le FormData, puis tout passe ici avant la moindre requête.
 *
 * Une indemnité est autonome : elle porte elle-même les informations du match indemnisé,
 * sans référence obligatoire à un match complet (arbitres, notes : bloc ultérieur).
 * - équipes : un club existant (par identifiant) ou un nouveau, créé à la volée avec son nom
 *   et son code postal seulement (le reste de l'adresse se complète dans « Clubs ») ;
 * - adresse : celle du club de l'équipe 1 par défaut, une autre seulement en cas
 *   d'exception (case à cocher) ;
 * - distance : saisie en km aller, stockée en mètres aller-retour (×2) ;
 * - doublé (§15.4.5) : case « déplacement déjà compté sur un autre match », kilométrage à 0 ;
 *   la distance devient alors facultative (vide = 0) ;
 * - tour de coupe (§15.4.6) : vide (`null`) hors coupe ; son obligation pour un niveau de
 *   coupe se vérifie en base, avec le niveau (le schéma ne sait pas si c'en est un) ;
 * - plateau (§15.4.7) : pas d'équipe 2 (`null`, club organisateur seul), un nombre de
 *   matchs et un montant par match saisi (le barème ne donne alors que le taux km) ; comme
 *   le tour, leur cohérence avec le niveau se vérifie en base.
 */
import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { MAX_ONE_WAY_DISTANCE_M, ONE_WAY_KM_PATTERN, oneWayKmToMeters } from "@/lib/distance";
import { ValidationError } from "@/lib/errors";
import { isTimeOfDay, parisLocalToUtc } from "@/lib/paris-time";
import { parsePayerKey } from "@/lib/payers";
import { MAX_GAME_COUNT } from "@/server/compensation/amount";
import { optionalFfbbLinkSchema } from "./ffbb-link";
import { gameAmountSchema } from "./scales";
import { cupRoundSchema } from "@/server/db/divisions";

/** Bornes raisonnables pour la date d'un match. */
const MATCH_DATE_MIN = "2000-01-01";
const MATCH_DATE_MAX = "2100-12-31";

/** Aucun caractère de contrôle (sauts de ligne, tabulations, NUL…). */
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;
/** Code postal générique (France et étranger) : lettres, chiffres, espace, tiret. */
const POSTAL_CODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z -]{1,9}$/;

export const postalCodeSchema = z.string().trim().regex(POSTAL_CODE_PATTERN);

const requiredText = (max: number) => z.string().trim().min(1).max(max).regex(NO_CONTROL_CHARS);

/**
 * Nom de club : toujours enregistré en majuscules (« BC BÉTHUNE »), comme sur les feuilles de
 * match. Locale française : les lettres accentuées gardent leur accent (é → É, ç → Ç).
 */
export const clubNameSchema = requiredText(255).transform((value) =>
  value.toLocaleUpperCase("fr-FR"),
);

/** Champ texte facultatif : une saisie vide devient `null` (colonne NULL). */
export const optionalText = (max: number) =>
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
  /** Nom de la salle (« Gymnase de la Courrouze »), facultatif. */
  name: optionalText(255),
  street: requiredText(255),
  number: optionalText(20),
  postalCode: postalCodeSchema,
  city: requiredText(255),
  country: optionalText(100),
});

/** Nombre de salles d'un club, principale comprise : borne de sécurité (§15.4.1). */
export const MAX_CLUB_VENUES = 20;

/**
 * Autre salle d'un club, importée de l'annuaire FFBB : nom et adresse, le code postal
 * seul obligatoire (comme l'adresse d'un club). Un champ inconnu arrive vide (saisie) ou
 * `null` (liste JSON de l'annuaire) : il devient `null`.
 */
export const clubVenueSchema = z.object({
  name: optionalText(255).nullable(),
  street: optionalText(255).nullable(),
  number: optionalText(20).nullable(),
  postalCode: postalCodeSchema,
  city: optionalText(255).nullable(),
});

export type ClubVenue = z.output<typeof clubVenueSchema>;

/** Autres salles d'un nouveau club (champ caché, liste JSON). */
export const clubVenuesSchema = z.array(clubVenueSchema).max(MAX_CLUB_VENUES - 1);

/**
 * Équipe : désignée par son club. L'équipe elle-même (club + niveau du match) est
 * retrouvée ou créée côté serveur. Un nouveau club ne demande que son nom et son code
 * postal (§15.4.1) : le code postal suffit à déduire l'organisme qui verse. Choisi dans
 * l'annuaire FFBB, il arrive avec le nom, la rue, le numéro et la ville de sa salle
 * principale, ses autres salles et son lien FFBB (logo, couleur), tous facultatifs.
 */
export const teamChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), clubId: z.uuid() }),
  z.object({
    kind: z.literal("new"),
    name: clubNameSchema,
    postalCode: postalCodeSchema,
    street: optionalText(255).optional(),
    number: optionalText(20).optional(),
    city: optionalText(255).optional(),
    venueName: optionalText(255).optional(),
    venues: clubVenuesSchema.optional(),
    ffbb: optionalFfbbLinkSchema.optional(),
  }),
]);

/** Nouveau club validé (indemnité, match, collègue). */
export type NewClubChoice = Extract<z.output<typeof teamChoiceSchema>, { kind: "new" }>;

/**
 * Adresse du match : celle du club de l'équipe 1 (cas normal), ou une autre (autre salle
 * du club, adresse déjà connue ou nouvelle), rattachée alors aux salles du club.
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
  /** Liste « Tour de coupe » : vide ou absente = pas de tour. */
  cupRound: z
    .union([cupRoundSchema, z.literal("")])
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value)),
  team1: teamChoiceSchema,
  /** `null` : liste absente (plateau, club organisateur seul). */
  team2: teamChoiceSchema.nullable(),
  venue: venueChoiceSchema,
};

/** Nombre de matchs d'un plateau (§15.4.7) : vide ou absent = `null` (hors plateau). */
const gameCountSchema = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{1,2}$/)
      .transform(Number)
      .refine((value) => value >= 1 && value <= MAX_GAME_COUNT),
    z.literal(""),
  ])
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : value));

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

/** Distance laissée vide : acceptée seulement sur un doublé (vérifié dans `refineTravel`). */
const emptyDistanceSchema = z
  .string()
  .trim()
  .max(0)
  .transform(() => null);

/** Montant par match d'un plateau, en euros (§15.4.7) : vide ou absent = `null` (hors plateau). */
const plateauGameAmountSchema = z
  .union([gameAmountSchema, z.literal("")])
  .optional()
  .transform((value) => (value === undefined || value === "" ? null : value));

const compensationFieldsSchema = z.object({
  ...matchFieldsShape,
  scaleId: z.uuid(),
  payer: payerChoiceSchema,
  oneWayDistance: z.union([oneWayDistanceSchema, emptyDistanceSchema]),
  travelShared: z.boolean(),
  gameCount: gameCountSchema,
  plateauGameAmount: plateauGameAmountSchema,
});

/** Doublé (§15.4.5) : sans case cochée, la distance reste obligatoire. */
function refineTravel(
  value: { oneWayDistance: number | null; travelShared: boolean },
  ctx: z.RefinementCtx,
): void {
  if (value.oneWayDistance === null && !value.travelShared) {
    ctx.addIssue({ code: "custom", path: ["oneWayDistance"], message: "distance_required" });
  }
}

const matchFieldsSchema = z.object(matchFieldsShape);

type MatchFieldsValue = z.output<typeof matchFieldsSchema>;

/** Règles croisées : deux clubs différents, heure qui existe ce jour-là à Paris. */
function refineMatchFields(value: MatchFieldsValue, ctx: z.RefinementCtx): void {
  if (
    value.team1.kind === "existing" &&
    value.team2?.kind === "existing" &&
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
    cupRound: value.cupRound,
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
  .superRefine(refineTravel)
  .transform((value, ctx) => {
    const info = toMatchInfo(value, ctx);
    return {
      ...info,
      scaleId: value.scaleId,
      payer: value.payer,
      // Doublé sans distance : 0 m, le kilométrage vaut 0 de toute façon.
      distanceM: value.oneWayDistance ?? 0,
      travelShared: value.travelShared,
      gameCount: value.gameCount,
      /** Montant par match du plateau, en centimes. */
      plateauGameCents: value.plateauGameAmount,
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
