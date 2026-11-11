/**
 * Requêtes SQL du paiement des indemnités (bloc 10) : indemnités jouées non payées
 * (accueil, page « À rembourser »), validation d'une sélection, annulation d'un paiement.
 *
 * Propriété (§6.2) : chaque requête filtre sur `user_id`, jointures comprises. Les
 * identifiants envoyés par le formulaire ne modifient donc jamais l'indemnité d'un autre.
 */
import { z } from "zod";
import { assertIsoDate } from "@/lib/dates";
import { effectivePayer } from "@/lib/payers";
import type { Payer } from "@/lib/payers";
import {
  MATCH_PARTIES_COLUMNS,
  matchPartiesFields,
  matchTeamJoins,
  toMatchParties,
} from "./match-info";
import type { MatchDivision } from "./match-info";
import type { Queryable } from "./users";

/** Indemnité jouée en attente de paiement, avec ce qu'il faut pour calculer son montant. */
export type UnpaidCompensation = {
  id: string;
  startsAt: Date;
  division: MatchDivision;
  team1Name: string;
  team2Name: string;
  distanceM: number;
  gameAmountCents: number;
  centsPerKm: string;
  /** Organisme qui verse (choix enregistré, sinon déduit), ou `null` si inconnu. */
  payer: Payer | null;
};

// Index partiel `compensation_unpaid_idx` (migration 015).
const LIST_UNPAID_SQL = `SELECT c.id, c.starts_at, c.distance_m,
  ${MATCH_PARTIES_COLUMNS},
  r.game_amount_cents, r.cents_per_km::text AS cents_per_km,
  c.payer AS payer_override, a.postal_code, a.country
FROM compensation c
JOIN division d ON d.id = c.division_id
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
${matchTeamJoins("c")}
JOIN scale_rate r ON r.id = c.scale_rate_id
WHERE c.user_id = $1 AND c.deleted_at IS NULL AND c.paid_on IS NULL AND c.starts_at < $2
ORDER BY c.starts_at, c.id`;

// `paid_on IS NULL` : valider deux fois ne réécrit pas la date d'un paiement déjà noté.
const MARK_PAID_SQL = `UPDATE compensation
SET paid_on = $3::date
WHERE user_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL AND paid_on IS NULL
RETURNING id`;

const CLEAR_PAYMENT_SQL = `UPDATE compensation
SET paid_on = NULL
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND paid_on IS NOT NULL
RETURNING id`;

const unpaidRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  distance_m: z.number().int(),
  ...matchPartiesFields,
  game_amount_cents: z.number().int(),
  cents_per_km: z.string(),
  payer_override: z.string().nullable(),
  postal_code: z.string(),
  country: z.string().nullable(),
});

/**
 * Indemnités actives non payées dont le match a commencé avant `before` (un match à venir
 * n'est pas encore dû), de la plus ancienne à la plus récente.
 */
export async function listUnpaidPlayedCompensations(
  db: Queryable,
  input: { userId: string; before: Date },
): Promise<UnpaidCompensation[]> {
  const result = await db.query(LIST_UNPAID_SQL, [input.userId, input.before]);
  return result.rows.map((raw) => {
    const row = unpaidRowSchema.parse(raw);
    return {
      id: row.id,
      startsAt: row.starts_at,
      ...toMatchParties(row),
      distanceM: row.distance_m,
      gameAmountCents: row.game_amount_cents,
      centsPerKm: row.cents_per_km,
      payer: effectivePayer({
        override: row.payer_override,
        category: row.division,
        postalCode: row.postal_code,
        country: row.country,
      }),
    };
  });
}

/**
 * Note le paiement des indemnités de la sélection qui sont à l'utilisateur, actives et pas
 * encore payées. Renvoie le nombre d'indemnités modifiées (les autres sont ignorées).
 */
export async function markCompensationsPaid(
  db: Queryable,
  input: { userId: string; compensationIds: readonly string[]; paidOn: string },
): Promise<number> {
  assertIsoDate(input.paidOn);
  const result = await db.query(MARK_PAID_SQL, [
    input.userId,
    [...input.compensationIds],
    input.paidOn,
  ]);
  return result.rows.length;
}

/** Annule le paiement d'une indemnité de l'utilisateur. `false` si elle n'était pas payée. */
export async function clearCompensationPayment(
  db: Queryable,
  input: { userId: string; compensationId: string },
): Promise<boolean> {
  const result = await db.query(CLEAR_PAYMENT_SQL, [input.compensationId, input.userId]);
  return result.rows.length > 0;
}
