/**
 * Lecture des matchs pour le calendrier (bloc 8) : flux d'abonnement et export d'un match.
 * Source : les indemnités, qui portent les informations du match (§3.8).
 *
 * Strict nécessaire (§5.4) : horaire, équipes, niveau et adresse. Ni montant, ni barème,
 * ni distance ne sont lus. Chaque requête filtre sur `user_id` et exclut les supprimées.
 */
import { z } from "zod";
import { MAX_COMPENSATIONS_PER_USER } from "./compensations";
import {
  MATCH_ADDRESS_COLUMNS,
  MATCH_PARTIES_COLUMNS,
  matchAddressFields,
  matchPartiesFields,
  matchTeamJoins,
  toMatchAddress,
  toMatchParties,
} from "./match-info";
import type { MatchAddress, MatchDivision } from "./match-info";
import type { Queryable } from "./users";

export type CalendarMatch = {
  /** Identifiant de l'indemnité : base de l'UID, stable tant qu'elle existe. */
  id: string;
  startsAt: Date;
  updatedAt: Date;
  division: MatchDivision;
  team1Name: string;
  team2Name: string;
  address: MatchAddress;
};

const SELECT_FROM = `SELECT c.id, c.starts_at, c.updated_at,
  ${MATCH_PARTIES_COLUMNS},
  ${MATCH_ADDRESS_COLUMNS}
FROM compensation c
JOIN division d ON d.id = c.division_id
${matchTeamJoins("c")}
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id`;

// Utilise l'index partiel compensation_user_starts_at_idx (user_id, starts_at).
const LIST_SINCE_SQL = `${SELECT_FROM}
WHERE c.user_id = $1 AND c.deleted_at IS NULL AND c.starts_at >= $2
ORDER BY c.starts_at, c.id
LIMIT $3`;

const FIND_ONE_SQL = `${SELECT_FROM}
WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL`;

const calendarMatchRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  updated_at: z.date(),
  ...matchPartiesFields,
  ...matchAddressFields,
});

function toCalendarMatch(raw: Record<string, unknown>): CalendarMatch {
  const row = calendarMatchRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    updatedAt: row.updated_at,
    ...toMatchParties(row),
    address: toMatchAddress(row),
  };
}

/** Matchs actifs de l'utilisateur commençant à partir de `from`, du plus ancien au plus récent. */
export async function listCalendarMatchesSince(
  db: Queryable,
  input: { userId: string; from: Date },
): Promise<CalendarMatch[]> {
  // La limite d'indemnités actives borne déjà le flux ; la répéter ici protège la requête.
  const result = await db.query(LIST_SINCE_SQL, [
    input.userId,
    input.from,
    MAX_COMPENSATIONS_PER_USER,
  ]);
  return result.rows.map(toCalendarMatch);
}

/** Un match actif de l'utilisateur ; `null` s'il est introuvable, supprimé ou à un autre compte. */
export async function findCalendarMatch(
  db: Queryable,
  input: { compensationId: string; userId: string },
): Promise<CalendarMatch | null> {
  const result = await db.query(FIND_ONE_SQL, [input.compensationId, input.userId]);
  const raw = result.rows[0];
  return raw === undefined ? null : toCalendarMatch(raw);
}
