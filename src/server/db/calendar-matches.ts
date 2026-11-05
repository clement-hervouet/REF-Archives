/**
 * Lecture des matchs pour le calendrier (bloc 8) : flux d'abonnement et export d'un match.
 * Source : les indemnités, qui portent les informations du match (§3.8).
 *
 * Strict nécessaire (§5.4) : horaire, équipes, niveau et adresse. Ni montant, ni barème,
 * ni distance ne sont lus. Chaque requête filtre sur `user_id` et exclut les supprimées.
 */
import { z } from "zod";
import { MAX_COMPENSATIONS_PER_USER } from "./compensations";
import { divisionCategorySchema, divisionLevelSchema, divisionTypeSchema } from "./divisions";
import type { DivisionCategory, DivisionLevel, DivisionType } from "./divisions";
import type { Queryable } from "./users";

export type CalendarMatch = {
  /** Identifiant de l'indemnité : base de l'UID, stable tant qu'elle existe. */
  id: string;
  startsAt: Date;
  updatedAt: Date;
  division: { category: DivisionCategory; type: DivisionType; level: DivisionLevel };
  team1Name: string;
  team2Name: string;
  address: { street: string; number: string | null; postalCode: string; city: string };
};

// Les jointures reprennent user_id : on ne lit jamais l'équipe, le club ou l'adresse d'un autre.
const SELECT_FROM = `SELECT c.id, c.starts_at, c.updated_at,
  d.division, d.type, d.level,
  club1.name AS team1_name, club2.name AS team2_name,
  a.street, a.number, a.postal_code, a.city
FROM compensation c
JOIN division d ON d.id = c.division_id
JOIN team t1 ON t1.id = c.team1_id AND t1.user_id = c.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = c.user_id
JOIN team t2 ON t2.id = c.team2_id AND t2.user_id = c.user_id
JOIN club club2 ON club2.id = t2.club_id AND club2.user_id = c.user_id
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
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  team1_name: z.string(),
  team2_name: z.string(),
  street: z.string(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string(),
});

function toCalendarMatch(raw: Record<string, unknown>): CalendarMatch {
  const row = calendarMatchRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    updatedAt: row.updated_at,
    division: { category: row.division, type: row.type, level: row.level },
    team1Name: row.team1_name,
    team2Name: row.team2_name,
    address: {
      street: row.street,
      number: row.number,
      postalCode: row.postal_code,
      city: row.city,
    },
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
