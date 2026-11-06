/**
 * Requêtes SQL des notes de match (bloc 9) : au plus une note active par match (index
 * `note_one_active_per_game_key`), ses liens de clips dans `note_clip`.
 *
 * Les liens sont stockés tels que normalisés par `noteFormSchema` et ne sont jamais
 * résolus côté serveur (§6.4 A10). Chaque requête filtre sur `user_id`.
 */
import { z } from "zod";
import type { Queryable } from "./users";

export type NoteContent = {
  confidence: number | null;
  stress: number | null;
  management: number | null;
  judgment: number | null;
  body: string | null;
  /** Liens dans l'ordre choisi par l'utilisateur. */
  clips: string[];
};

export type Note = NoteContent & { id: string; updatedAt: Date };

const idRowSchema = z.object({ id: z.uuid() });

// Crée la note du match ou remplace celle qui existe. La cible du ON CONFLICT reprend
// l'index partiel : une note supprimée (soft delete) n'empêche pas d'en écrire une neuve.
const UPSERT_NOTE_SQL = `INSERT INTO note
  (user_id, game_id, confidence, stress, management, judgment, body)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (game_id) WHERE deleted_at IS NULL
DO UPDATE SET confidence = EXCLUDED.confidence, stress = EXCLUDED.stress,
  management = EXCLUDED.management, judgment = EXCLUDED.judgment, body = EXCLUDED.body
RETURNING id`;

const DELETE_CLIPS_SQL = `DELETE FROM note_clip WHERE note_id = $1 AND user_id = $2`;

// WITH ORDINALITY numérote les liens à partir de 1 : la position commence à 0.
const INSERT_CLIPS_SQL = `INSERT INTO note_clip (user_id, note_id, position, url)
SELECT $1::uuid, $2::uuid, (t.ord - 1)::smallint, t.url
FROM unnest($3::text[]) WITH ORDINALITY AS t(url, ord)`;

const SOFT_DELETE_NOTE_SQL = `UPDATE note SET deleted_at = now()
WHERE game_id = $1 AND user_id = $2 AND deleted_at IS NULL
RETURNING id`;

const FIND_NOTE_SQL = `SELECT n.id, n.confidence, n.stress, n.management, n.judgment, n.body, n.updated_at,
  coalesce(array_agg(c.url ORDER BY c.position) FILTER (WHERE c.id IS NOT NULL), '{}') AS clips
FROM note n
LEFT JOIN note_clip c ON c.note_id = n.id AND c.user_id = n.user_id
WHERE n.game_id = $1 AND n.user_id = $2 AND n.deleted_at IS NULL
GROUP BY n.id`;

const noteRowSchema = z.object({
  id: z.uuid(),
  confidence: z.number().int().nullable(),
  stress: z.number().int().nullable(),
  management: z.number().int().nullable(),
  judgment: z.number().int().nullable(),
  body: z.string().nullable(),
  updated_at: z.date(),
  clips: z.array(z.string()),
});

/**
 * Écrit la note d'un match de l'utilisateur et remplace ses liens. Le match doit être
 * actif, à l'utilisateur et verrouillé dans la même transaction.
 */
export async function saveNote(
  db: Queryable,
  input: { userId: string; gameId: string; note: NoteContent },
): Promise<string> {
  const { note } = input;
  const result = await db.query(UPSERT_NOTE_SQL, [
    input.userId,
    input.gameId,
    note.confidence,
    note.stress,
    note.management,
    note.judgment,
    note.body,
  ]);
  const noteId = idRowSchema.parse(result.rows[0]).id;
  await db.query(DELETE_CLIPS_SQL, [noteId, input.userId]);
  if (note.clips.length > 0) {
    await db.query(INSERT_CLIPS_SQL, [input.userId, noteId, note.clips]);
  }
  return noteId;
}

/** Supprime (soft delete) la note d'un match de l'utilisateur. Faux s'il n'y en a pas. */
export async function softDeleteNote(
  db: Queryable,
  input: { userId: string; gameId: string },
): Promise<boolean> {
  const result = await db.query(SOFT_DELETE_NOTE_SQL, [input.gameId, input.userId]);
  return result.rows.length > 0;
}

/** Note active d'un match de l'utilisateur ; `null` s'il n'y en a pas. */
export async function findNote(
  db: Queryable,
  input: { userId: string; gameId: string },
): Promise<Note | null> {
  const result = await db.query(FIND_NOTE_SQL, [input.gameId, input.userId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = noteRowSchema.parse(raw);
  return {
    id: row.id,
    confidence: row.confidence,
    stress: row.stress,
    management: row.management,
    judgment: row.judgment,
    body: row.body,
    clips: row.clips,
    updatedAt: row.updated_at,
  };
}
