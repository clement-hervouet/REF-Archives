/**
 * Matchs à venir pour la page « À venir » et l'email du récapitulatif (blocs 7 et 9) :
 * les indemnités de la période, avec les officiels du match complet lié s'il existe.
 *
 * Ni montant, ni barème, ni distance (fiche pratique). Filtrée par propriétaire, jointures
 * comprises (§6.2) : on ne lit jamais l'équipe, le club, l'adresse ou la personne d'un autre.
 */
import { z } from "zod";
import { OFFICIAL_SLOTS } from "@/lib/game-form-fields";
import type { OfficialSlot } from "@/lib/game-form-fields";
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

/** Personne à une place, réduite à ce qui s'affiche. */
type UpcomingOfficial = {
  slot: OfficialSlot;
  isSelf: boolean;
  firstname: string | null;
  lastname: string | null;
};

export type UpcomingMatchRow = {
  /** Identifiant de l'indemnité (export `.ics`, modification). */
  id: string;
  startsAt: Date;
  division: MatchDivision;
  team1Name: string;
  team2Name: string;
  address: MatchAddress;
  /** Match complet lié, s'il existe. */
  gameId: string | null;
  /** Officiels dans l'ordre officiel ; vide sans match complet. */
  officials: UpcomingOfficial[];
};

// Les quatre places deviennent des lignes (VALUES latéral) pour être agrégées dans l'ordre
// officiel. Le match lié doit être actif et au même utilisateur.
const LIST_UPCOMING_SQL = `SELECT c.id, c.starts_at, c.game_id,
  ${MATCH_PARTIES_COLUMNS},
  ${MATCH_ADDRESS_COLUMNS},
  coalesce((
    SELECT json_agg(json_build_object(
      'slot', o.slot, 'is_self', p.is_self, 'firstname', p.firstname, 'lastname', p.lastname
    ) ORDER BY o.ord)
    FROM game g
    CROSS JOIN LATERAL (VALUES
      (1, 'referee1', g.referee1_id),
      (2, 'referee2', g.referee2_id),
      (3, 'referee3', g.referee3_id),
      (4, 'observer', g.observer_id)
    ) AS o(ord, slot, person_id)
    JOIN person p ON p.id = o.person_id AND p.user_id = g.user_id
    WHERE g.id = c.game_id AND g.user_id = c.user_id AND g.deleted_at IS NULL
  ), '[]'::json) AS officials
FROM compensation c
JOIN division d ON d.id = c.division_id
${matchTeamJoins("c")}
JOIN address a ON a.id = c.address_id AND a.user_id = c.user_id
WHERE c.user_id = $1 AND c.deleted_at IS NULL AND c.starts_at >= $2 AND c.starts_at < $3
ORDER BY c.starts_at, c.id`;

const officialRowSchema = z.object({
  slot: z.enum(OFFICIAL_SLOTS),
  is_self: z.boolean(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
});

const rowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  game_id: z.uuid().nullable(),
  ...matchPartiesFields,
  ...matchAddressFields,
  officials: z.array(officialRowSchema),
});

/** Matchs dont le coup d'envoi est dans `[from, to)`, dans l'ordre chronologique. */
export async function listUpcomingMatches(
  db: Queryable,
  input: { userId: string; from: Date; to: Date },
): Promise<UpcomingMatchRow[]> {
  const result = await db.query(LIST_UPCOMING_SQL, [input.userId, input.from, input.to]);
  return result.rows.map((raw) => {
    const row = rowSchema.parse(raw);
    return {
      id: row.id,
      startsAt: row.starts_at,
      ...toMatchParties(row),
      address: toMatchAddress(row),
      gameId: row.game_id,
      officials: row.officials.map((official) => ({
        slot: official.slot,
        isSelf: official.is_self,
        firstname: official.firstname,
        lastname: official.lastname,
      })),
    };
  });
}
