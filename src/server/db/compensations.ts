/**
 * Lectures des indemnités (bloc 6) : référentiel (division), barème applicable, vérification
 * d'adresse, totaux, liste et valeurs de modification. Les écritures (adresses, clubs,
 * équipes, indemnité, modification, suppression) sont dans `compensation-writes.ts`.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`. Les FK composites (x_id, user_id)
 * l'imposent aussi en base ; les vérifications ici servent à répondre « introuvable »
 * proprement au lieu de laisser échouer une contrainte.
 */
import { z } from "zod";
import { departmentFromPostalCode, effectivePayer } from "@/lib/payers";
import type { Payer } from "@/lib/payers";
import {
  cupRoundSchema,
  divisionCategorySchema,
  divisionLevelSchema,
  divisionTypeSchema,
} from "./divisions";
import type { CupRound } from "./divisions";
import {
  MATCH_ADDRESS_COLUMNS,
  matchPartiesColumns,
  matchPartiesFields,
  matchTeamJoins,
  toMatchAddress,
  toMatchParties,
} from "./match-info";
import type { MatchAddress, MatchDivision } from "./match-info";
import type { Queryable } from "./users";

/** Limite anti-abus (application potentiellement publique) ; borne aussi le flux iCal. */
export const MAX_COMPENSATIONS_PER_USER = 10_000;

/** Ligne de barème utilisable pour calculer une indemnité. */
export type ApplicableRate = {
  id: string;
  /** Date d'application `AAAA-MM-JJ` (Europe/Paris). */
  effectiveFrom: string;
  gameAmountCents: number;
  /** Centimes par km, chaîne `numeric` exacte (ex. `"40.00"`). */
  centsPerKm: string;
};

// ─── Finale de coupe ────────────────────────────────────────────────────────

/** Coupe dont une finale vient d'être enregistrée : de quoi la nommer (« CBU18F »). */
export type CupFinal = Pick<MatchDivision, "category" | "type" | "level" | "cup" | "department">;

// L'adresse est filtrée par propriétaire ; la division est un référentiel global.
const FIND_CUP_FINAL_SQL = `SELECT d.division, d.type, d.level, a.postal_code, a.country
FROM division d
JOIN address a ON a.id = $2 AND a.user_id = $3
WHERE d.id = $1 AND d.cup`;

const cupFinalRowSchema = z.object({
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  postal_code: z.string(),
  country: z.string().nullable(),
});

/**
 * Coupe et département du lieu d'une finale (§15.4.6), pour le message de félicitations.
 * `null` si la division n'est pas une coupe ou si l'adresse n'est pas à l'utilisateur.
 */
export async function findCupFinal(
  db: Queryable,
  input: { divisionId: string; addressId: string; userId: string },
): Promise<CupFinal | null> {
  const result = await db.query(FIND_CUP_FINAL_SQL, [
    input.divisionId,
    input.addressId,
    input.userId,
  ]);
  const raw: unknown = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = cupFinalRowSchema.parse(raw);
  return {
    category: row.division,
    type: row.type,
    level: row.level,
    cup: true,
    department: departmentFromPostalCode(row.postal_code, row.country),
  };
}

// ─── Barème applicable ──────────────────────────────────────────────────────

// LEFT JOIN : un barème choisissable mais encore sans ligne renvoie une ligne de NULL,
// ce qui distingue « barème introuvable » de « aucune ligne en vigueur ».
// Choisissable = à l'utilisateur ou commun, et non archivé.
const LIST_APPLICABLE_RATES_SQL = `SELECT r.id, r.effective_from::text AS effective_from,
  r.game_amount_cents, r.cents_per_km::text AS cents_per_km
FROM scale s
LEFT JOIN scale_rate r ON r.scale_id = s.id
WHERE s.id = $1 AND (s.user_id = $2 OR s.user_id IS NULL) AND s.deleted_at IS NULL`;

const applicableRateRowSchema = z.union([
  z.object({
    id: z.uuid(),
    effective_from: z.string(),
    game_amount_cents: z.number().int(),
    cents_per_km: z.string(),
  }),
  z.object({
    id: z.null(),
    effective_from: z.null(),
    game_amount_cents: z.null(),
    cents_per_km: z.null(),
  }),
]);

/**
 * Lignes d'un barème que l'utilisateur peut choisir (le sien ou le commun).
 * `null` si le barème n'existe pas, est archivé ou appartient à un autre utilisateur.
 */
export async function listApplicableRates(
  db: Queryable,
  input: { scaleId: string; userId: string },
): Promise<ApplicableRate[] | null> {
  const result = await db.query(LIST_APPLICABLE_RATES_SQL, [input.scaleId, input.userId]);
  if (result.rows.length === 0) {
    return null;
  }
  const rates: ApplicableRate[] = [];
  for (const raw of result.rows) {
    const row = applicableRateRowSchema.parse(raw);
    if (row.id !== null) {
      rates.push({
        id: row.id,
        effectiveFrom: row.effective_from,
        gameAmountCents: row.game_amount_cents,
        centsPerKm: row.cents_per_km,
      });
    }
  }
  return rates;
}

// ─── Vérification d'adresse ─────────────────────────────────────────────────

const ADDRESS_OWNED_SQL = `SELECT id FROM address WHERE id = $1 AND user_id = $2`;

/** Vrai si l'adresse existe et appartient à l'utilisateur. */
export async function addressBelongsTo(
  db: Queryable,
  input: { addressId: string; userId: string },
): Promise<boolean> {
  const result = await db.query(ADDRESS_OWNED_SQL, [input.addressId, input.userId]);
  return result.rows.length > 0;
}

// ─── Nombre d'indemnités ────────────────────────────────────────────────────

const COUNT_COMPENSATIONS_IN_RANGE_SQL = `SELECT count(*)::integer AS count
FROM compensation
WHERE user_id = $1 AND deleted_at IS NULL AND starts_at >= $2 AND starts_at < $3`;

const countRowSchema = z.object({ count: z.number().int().nonnegative() });

/**
 * Nombre d'indemnités actives de `userId` dont le match commence dans `[from, to[`
 * (ex. une saison FFBB, bloc 12d). Les indemnités supprimées ne comptent pas.
 */
export async function countCompensationsInRange(
  db: Queryable,
  input: { userId: string; from: Date; to: Date },
): Promise<number> {
  const result = await db.query(COUNT_COMPENSATIONS_IN_RANGE_SQL, [
    input.userId,
    input.from,
    input.to,
  ]);
  return countRowSchema.parse(result.rows[0]).count;
}

// ─── Liste et valeurs de modification ──────────────────────────────────────

/** Ce qu'il faut pour calculer le montant d'une indemnité (totaux mensuels). */
export type CompensationAmountRow = {
  startsAt: Date;
  distanceM: number;
  /** Doublé (§15.4.5) : kilométrage déjà compté sur un autre match. */
  travelShared: boolean;
  gameAmountCents: number;
  centsPerKm: string;
  /** Jour du paiement `AAAA-MM-JJ` (bloc 10), ou `null` s'il n'est pas encore payé. */
  paidOn: string | null;
  /** Organisme qui verse l'indemnité (choix enregistré, sinon déduit), ou `null` si inconnu. */
  payer: Payer | null;
};

export type CompensationListItem = CompensationAmountRow & {
  id: string;
  division: MatchDivision;
  team1Name: string;
  team2Name: string;
  address: MatchAddress;
  scaleName: string;
  /** Match complet lié (bloc 9), s'il existe. */
  gameId: string | null;
};

/** Valeurs d'une indemnité pour préremplir le formulaire de modification. */
export type CompensationForEdit = {
  id: string;
  startsAt: Date;
  divisionId: string;
  /** Tour de coupe (§15.4.6), `null` hors coupe. */
  cupRound: CupRound | null;
  team1ClubId: string;
  team2ClubId: string;
  addressId: string;
  /** Adresse du club de l'équipe 1 : si c'est celle du match, la case « exception » est décochée. */
  team1AddressId: string;
  scaleId: string;
  distanceM: number;
  travelShared: boolean;
  /** Organisme choisi explicitement (clé), ou `null` pour la déduction automatique. */
  payer: string | null;
};

// Les jointures reprennent user_id : on ne lit jamais l'équipe, le club ou l'adresse d'un autre.
// Niveau, code postal et pays : de quoi déduire l'organisme qui verse (bloc 10).
const LIST_AMOUNTS_SQL = `SELECT c.starts_at, c.distance_m, c.travel_shared, r.game_amount_cents,
  r.cents_per_km::text AS cents_per_km, c.paid_on::text AS paid_on,
  c.payer AS payer_override, d.division, a.postal_code, a.country
FROM compensation c
JOIN scale_rate r ON r.id = c.scale_rate_id
JOIN division d ON d.id = c.division_id
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
WHERE c.user_id = $1 AND c.deleted_at IS NULL`;

// `paid_on::text` : une colonne `date` lue telle quelle deviendrait un Date JavaScript à
// minuit dans le fuseau du serveur, et pourrait changer de jour.
const LIST_IN_RANGE_SQL = `SELECT c.id, c.starts_at, c.distance_m, c.travel_shared, c.game_id, c.paid_on::text AS paid_on,
  c.payer AS payer_override,
  ${matchPartiesColumns("c")},
  ${MATCH_ADDRESS_COLUMNS}, a.country,
  s.name AS scale_name, r.game_amount_cents, r.cents_per_km::text AS cents_per_km
FROM compensation c
JOIN division d ON d.id = c.division_id
${matchTeamJoins("c")}
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
JOIN scale_rate r ON r.id = c.scale_rate_id
JOIN scale s ON s.id = r.scale_id
WHERE c.user_id = $1 AND c.deleted_at IS NULL AND c.starts_at >= $2 AND c.starts_at < $3
ORDER BY c.starts_at, c.id`;

const FIND_FOR_EDIT_SQL = `SELECT c.id, c.starts_at, c.division_id, c.cup_round, c.address_id,
  c.distance_m, c.travel_shared, c.payer,
  t1.club_id AS team1_club_id, t2.club_id AS team2_club_id,
  club1.address_id AS team1_address_id, r.scale_id
FROM compensation c
JOIN team t1 ON t1.id = c.team1_id AND t1.user_id = c.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = c.user_id
JOIN team t2 ON t2.id = c.team2_id AND t2.user_id = c.user_id
JOIN scale_rate r ON r.id = c.scale_rate_id
WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL`;

const amountRowSchema = z.object({
  starts_at: z.date(),
  distance_m: z.number().int(),
  travel_shared: z.boolean(),
  game_amount_cents: z.number().int(),
  cents_per_km: z.string(),
  paid_on: z.string().nullable(),
  payer_override: z.string().nullable(),
  division: divisionCategorySchema,
  postal_code: z.string(),
  country: z.string().nullable(),
});

const listItemRowSchema = amountRowSchema.extend({
  id: z.uuid(),
  ...matchPartiesFields,
  street: z.string().nullable(),
  number: z.string().nullable(),
  city: z.string().nullable(),
  scale_name: z.string(),
  game_id: z.uuid().nullable(),
});

const editRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  division_id: z.uuid(),
  cup_round: cupRoundSchema.nullable(),
  address_id: z.uuid(),
  distance_m: z.number().int(),
  travel_shared: z.boolean(),
  team1_club_id: z.uuid(),
  team2_club_id: z.uuid(),
  team1_address_id: z.uuid(),
  scale_id: z.uuid(),
  payer: z.string().nullable(),
});

function toAmountRow(row: z.infer<typeof amountRowSchema>): CompensationAmountRow {
  return {
    startsAt: row.starts_at,
    distanceM: row.distance_m,
    travelShared: row.travel_shared,
    gameAmountCents: row.game_amount_cents,
    centsPerKm: row.cents_per_km,
    paidOn: row.paid_on,
    payer: effectivePayer({
      override: row.payer_override,
      category: row.division,
      postalCode: row.postal_code,
      country: row.country,
    }),
  };
}

/** Toutes les indemnités actives de l'utilisateur, réduites au calcul du montant. */
export async function listCompensationAmounts(
  db: Queryable,
  userId: string,
): Promise<CompensationAmountRow[]> {
  const result = await db.query(LIST_AMOUNTS_SQL, [userId]);
  return result.rows.map((raw) => toAmountRow(amountRowSchema.parse(raw)));
}

/** Indemnités actives dont le match commence dans `[from, to)`, de la plus ancienne à la plus récente. */
export async function listCompensationsInRange(
  db: Queryable,
  input: { userId: string; from: Date; to: Date },
): Promise<CompensationListItem[]> {
  const result = await db.query(LIST_IN_RANGE_SQL, [input.userId, input.from, input.to]);
  return result.rows.map((raw) => {
    const row = listItemRowSchema.parse(raw);
    return {
      ...toAmountRow(row),
      id: row.id,
      ...toMatchParties(row),
      address: toMatchAddress(row),
      scaleName: row.scale_name,
      gameId: row.game_id,
    };
  });
}

/** Indemnité active de l'utilisateur, pour la modifier ; `null` si introuvable ou supprimée. */
export async function findCompensationForEdit(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<CompensationForEdit | null> {
  const result = await db.query(FIND_FOR_EDIT_SQL, [input.compensationId, input.userId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = editRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    divisionId: row.division_id,
    cupRound: row.cup_round,
    team1ClubId: row.team1_club_id,
    team2ClubId: row.team2_club_id,
    addressId: row.address_id,
    team1AddressId: row.team1_address_id,
    scaleId: row.scale_id,
    distanceM: row.distance_m,
    travelShared: row.travel_shared,
    payer: row.payer,
  };
}

// ─── Doublés ────────────────────────────────────────────────────────────────

/** Jour et adresse d'une indemnité : de quoi repérer un doublé dans le formulaire (§15.4.5). */
export type MatchDayVenue = {
  compensationId: string;
  /** Jour du match à Paris, `AAAA-MM-JJ`. */
  day: string;
  addressId: string;
};

// Indemnités actives des 12 derniers mois et à venir (index compensation_user_starts_at_idx),
// comme les niveaux souvent arbitrés. Le jour se lit à Paris, comme partout ailleurs.
const LIST_MATCH_DAY_VENUES_SQL = `SELECT id,
  (starts_at AT TIME ZONE 'Europe/Paris')::date::text AS day, address_id
FROM compensation
WHERE user_id = $1
  AND deleted_at IS NULL
  AND starts_at >= now() - interval '12 months'
ORDER BY starts_at, id`;

const matchDayVenueRowSchema = z.object({
  id: z.uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address_id: z.uuid(),
});

/** Jour et adresse des indemnités récentes et à venir de l'utilisateur. */
export async function listMatchDayVenues(db: Queryable, userId: string): Promise<MatchDayVenue[]> {
  const result = await db.query(LIST_MATCH_DAY_VENUES_SQL, [userId]);
  return result.rows.map((raw) => {
    const row = matchDayVenueRowSchema.parse(raw);
    return { compensationId: row.id, day: row.day, addressId: row.address_id };
  });
}
