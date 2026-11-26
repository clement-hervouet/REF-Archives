/**
 * Requêtes SQL des axes d'amélioration : une ligne par axe et par utilisateur (axe par défaut
 * ou catégorie personnelle, texte et position), indépendante des matchs. Chaque requête
 * filtre sur `user_id` (§6.2).
 */
import { z } from "zod";
import { IMPROVEMENT_AXES } from "@/lib/improvement-axes-fields";
import type { ImprovementAxisItem } from "@/lib/improvement-axes-fields";
import type { ImprovementAxisRow } from "../improvement/axis-list";
import type { Queryable } from "./users";

// Verrou propre aux axes de l'utilisateur, jusqu'à la fin de la transaction : deux
// enregistrements simultanés (deux onglets) s'exécutent l'un après l'autre, chacun sur la
// liste laissée par l'autre. Rien d'autre n'est bloqué.
const LOCK_IMPROVEMENT_AXES_SQL = `SELECT pg_advisory_xact_lock(
  hashtextextended('improvement_axis:' || $1::text, 0))`;

/** À appeler dans une transaction, avant de lire puis réécrire les axes. */
export async function lockImprovementAxes(db: Queryable, userId: string): Promise<void> {
  await db.query(LOCK_IMPROVEMENT_AXES_SQL, [userId]);
}

const FIND_IMPROVEMENT_AXES_SQL = `SELECT id, default_key, label, hidden, position, body,
  updated_at
FROM improvement_axis
WHERE user_id = $1
ORDER BY position`;

const common = {
  id: z.uuid(),
  position: z.number().int(),
  body: z.string().nullable(),
  updated_at: z.date(),
};

// Même règle qu'en base (`improvement_axis_kind_check`) : axe par défaut ou catégorie.
const rowSchema = z.union([
  z.object({
    ...common,
    default_key: z.enum(IMPROVEMENT_AXES),
    label: z.null(),
    hidden: z.boolean(),
  }),
  z.object({ ...common, default_key: z.null(), label: z.string(), hidden: z.literal(false) }),
]);

export type StoredImprovementAxes = {
  rows: ImprovementAxisRow[];
  /** Dernière modification d'un axe, `null` sans aucun enregistrement. */
  updatedAt: Date | null;
};

/** Lignes enregistrées des axes de l'utilisateur, par position. */
export async function findImprovementAxes(
  db: Queryable,
  userId: string,
): Promise<StoredImprovementAxes> {
  const result = await db.query(FIND_IMPROVEMENT_AXES_SQL, [userId]);
  const parsed = result.rows.map((raw) => rowSchema.parse(raw));
  const updatedAt = parsed.reduce<Date | null>(
    (latest, row) => (latest === null || row.updated_at > latest ? row.updated_at : latest),
    null,
  );
  const rows = parsed.map((row): ImprovementAxisRow => {
    const base = { id: row.id, position: row.position, body: row.body };
    return row.default_key === null
      ? { ...base, defaultKey: null, label: row.label, hidden: false }
      : { ...base, defaultKey: row.default_key, label: null, hidden: row.hidden };
  });
  return { rows, updatedAt };
}

// Axes par défaut (masqués compris) : crée les lignes manquantes, met à jour les autres. Une ligne inchangée
// n'est pas réécrite : sa date de mise à jour reste celle de sa dernière vraie modification.
const WRITE_DEFAULT_AXES_SQL = `INSERT INTO improvement_axis (user_id, default_key, position,
  body, hidden)
SELECT $1, t.default_key, t.position, t.body, t.hidden
FROM unnest($2::text[], $3::smallint[], $4::text[], $5::boolean[])
  AS t (default_key, position, body, hidden)
ON CONFLICT (user_id, default_key)
DO UPDATE SET position = EXCLUDED.position, body = EXCLUDED.body, hidden = EXCLUDED.hidden
WHERE (improvement_axis.position, improvement_axis.body, improvement_axis.hidden)
  IS DISTINCT FROM (EXCLUDED.position, EXCLUDED.body, EXCLUDED.hidden)`;

// Catégories personnelles : elles existent déjà (créées par `insertCustomImprovementAxis`).
const WRITE_CUSTOM_AXES_SQL = `UPDATE improvement_axis a
SET position = t.position, body = t.body
FROM unnest($2::uuid[], $3::smallint[], $4::text[]) AS t (id, position, body)
WHERE a.id = t.id AND a.user_id = $1 AND a.default_key IS NULL
  AND (a.position, a.body) IS DISTINCT FROM (t.position, t.body)`;

/**
 * Enregistre toute la liste : textes, et positions dans l'ordre de `list`. Dans une
 * transaction, après `lockImprovementAxes` (les positions sont uniques en fin de transaction).
 */
export async function writeImprovementAxes(
  db: Queryable,
  userId: string,
  list: readonly ImprovementAxisItem[],
): Promise<void> {
  const positioned = list.map((item, position) => ({ item, position }));
  const defaults = positioned.filter(({ item }) => item.defaultKey !== null);
  const customs = positioned.filter(({ item }) => item.defaultKey === null);
  if (defaults.length > 0) {
    await db.query(WRITE_DEFAULT_AXES_SQL, [
      userId,
      defaults.map(({ item }) => item.defaultKey),
      defaults.map(({ position }) => position),
      defaults.map(({ item }) => item.body),
      defaults.map(({ item }) => item.hidden),
    ]);
  }
  if (customs.length > 0) {
    await db.query(WRITE_CUSTOM_AXES_SQL, [
      userId,
      customs.map(({ item }) => item.slot),
      customs.map(({ position }) => position),
      customs.map(({ item }) => item.body),
    ]);
  }
}

const INSERT_CUSTOM_AXIS_SQL = `INSERT INTO improvement_axis (user_id, label, position)
VALUES ($1, $2, $3)`;

/** Ajoute une catégorie personnelle, texte vide, à la position donnée (en fin de liste). */
export async function insertCustomImprovementAxis(
  db: Queryable,
  input: { userId: string; label: string; position: number },
): Promise<void> {
  await db.query(INSERT_CUSTOM_AXIS_SQL, [input.userId, input.label, input.position]);
}

const RENAME_CUSTOM_AXIS_SQL = `UPDATE improvement_axis SET label = $3
WHERE id = $1 AND user_id = $2 AND default_key IS NULL`;

/** Renomme une catégorie personnelle (jamais un axe par défaut). */
export async function renameCustomImprovementAxis(
  db: Queryable,
  input: { userId: string; id: string; label: string },
): Promise<void> {
  await db.query(RENAME_CUSTOM_AXIS_SQL, [input.id, input.userId, input.label]);
}

const DELETE_CUSTOM_AXIS_SQL = `DELETE FROM improvement_axis
WHERE id = $1 AND user_id = $2 AND default_key IS NULL`;

/** Supprime une catégorie personnelle et son texte (jamais un axe par défaut). */
export async function deleteCustomImprovementAxis(
  db: Queryable,
  input: { userId: string; id: string },
): Promise<void> {
  await db.query(DELETE_CUSTOM_AXIS_SQL, [input.id, input.userId]);
}
