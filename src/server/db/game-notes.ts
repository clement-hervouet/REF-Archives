/**
 * Liste des matchs qui ont une note (page « Notes de match », bloc 9), filtrable par
 * catégorie et niveau de la division (ex. Régional, U15), type (masculin, féminin) et
 * club (l'une ou l'autre équipe). Filtrée par propriétaire, jointures comprises (§6.2) ; les filtres sont des
 * paramètres liés, jamais concaténés (§3.2).
 */
import { z } from "zod";
import type { OfficialSlot } from "@/lib/game-form-fields";
import type { GameNotesFilters } from "@/lib/schemas/game-notes-filters";
import { divisionCategorySchema, divisionLevelSchema, divisionTypeSchema } from "./divisions";
import type { DivisionCategory, DivisionLevel, DivisionType } from "./divisions";
import type { Queryable } from "./users";

/** Matchs par page. */
export const GAME_NOTES_PAGE_SIZE = 30;

/** Longueur de l'extrait du texte renvoyé par la liste (la note complète est sur la fiche). */
export const NOTE_EXCERPT_LENGTH = 280;

export type GameNoteListItem = {
  gameId: string;
  startsAt: Date;
  division: { category: DivisionCategory; type: DivisionType; level: DivisionLevel };
  team1Name: string;
  team2Name: string;
  /** Place occupée par l'utilisateur (`null` si sa fiche n'est plus parmi les officiels). */
  selfSlot: OfficialSlot | null;
  confidence: number | null;
  stress: number | null;
  /** Début du texte, `NOTE_EXCERPT_LENGTH` caractères au plus. */
  excerpt: string | null;
  excerptTruncated: boolean;
  clipCount: number;
  /** Faux pour un match sans note (filtre « tous les matchs »). */
  hasNote: boolean;
};

export type GameNotesPage = { items: GameNoteListItem[]; hasMore: boolean };

// Enumérations comparées en texte : le paramètre reste un simple texte lié.
// LIMIT + 1 : la ligne en trop indique seulement qu'une page suivante existe.
const LIST_GAMES_WITH_NOTES_SQL = `SELECT g.id, g.starts_at, d.division, d.type, d.level,
  club1.name AS team1_name, club2.name AS team2_name,
  CASE
    WHEN g.referee1_id = s.id THEN 'referee1'
    WHEN g.referee2_id = s.id THEN 'referee2'
    WHEN g.referee3_id = s.id THEN 'referee3'
    WHEN g.observer_id = s.id THEN 'observer'
  END AS self_slot,
  n.id IS NOT NULL AS has_note,
  n.confidence, n.stress,
  left(n.body, $7::integer) AS excerpt,
  coalesce(char_length(n.body) > $7::integer, false) AS excerpt_truncated,
  (SELECT count(*) FROM note_clip c WHERE c.note_id = n.id AND c.user_id = n.user_id)::integer
    AS clip_count
FROM game g
LEFT JOIN note n ON n.game_id = g.id AND n.user_id = g.user_id AND n.deleted_at IS NULL
JOIN division d ON d.id = g.division_id
JOIN team t1 ON t1.id = g.team1_id AND t1.user_id = g.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = g.user_id
JOIN team t2 ON t2.id = g.team2_id AND t2.user_id = g.user_id
JOIN club club2 ON club2.id = t2.club_id AND club2.user_id = g.user_id
LEFT JOIN person s ON s.user_id = g.user_id AND s.is_self
WHERE g.user_id = $1 AND g.deleted_at IS NULL
  AND ($2::text IS NULL OR d.division::text = $2::text)
  AND ($3::text IS NULL OR d.type::text = $3::text)
  AND ($4::uuid IS NULL OR club1.id = $4::uuid OR club2.id = $4::uuid)
  AND ($8::text IS NULL OR d.level::text = $8::text)
  AND ($9::boolean OR n.id IS NOT NULL)
ORDER BY g.starts_at DESC, g.id
LIMIT $5::integer OFFSET $6::integer`;

const rowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  team1_name: z.string(),
  team2_name: z.string(),
  self_slot: z.enum(["referee1", "referee2", "referee3", "observer"]).nullable(),
  confidence: z.number().int().nullable(),
  stress: z.number().int().nullable(),
  excerpt: z.string().nullable(),
  excerpt_truncated: z.boolean(),
  clip_count: z.number().int(),
  has_note: z.boolean(),
});

/**
 * Matchs actifs de l'utilisateur qui ont une note active (ou tous, avec
 * `includeWithoutNote`), du plus récent au plus ancien.
 */
export async function listGamesWithNotes(
  db: Queryable,
  input: { userId: string; filters: GameNotesFilters },
): Promise<GameNotesPage> {
  const { filters } = input;
  const result = await db.query(LIST_GAMES_WITH_NOTES_SQL, [
    input.userId,
    filters.category,
    filters.type,
    filters.clubId,
    GAME_NOTES_PAGE_SIZE + 1,
    (filters.page - 1) * GAME_NOTES_PAGE_SIZE,
    NOTE_EXCERPT_LENGTH,
    filters.level,
    filters.includeWithoutNote,
  ]);
  const rows = result.rows.map((raw) => rowSchema.parse(raw));
  return {
    hasMore: rows.length > GAME_NOTES_PAGE_SIZE,
    items: rows.slice(0, GAME_NOTES_PAGE_SIZE).map((row) => ({
      gameId: row.id,
      startsAt: row.starts_at,
      division: { category: row.division, type: row.type, level: row.level },
      team1Name: row.team1_name,
      team2Name: row.team2_name,
      selfSlot: row.self_slot,
      confidence: row.confidence,
      stress: row.stress,
      excerpt: row.excerpt,
      excerptTruncated: row.excerpt_truncated,
      clipCount: row.clip_count,
      hasNote: row.has_note,
    })),
  };
}
