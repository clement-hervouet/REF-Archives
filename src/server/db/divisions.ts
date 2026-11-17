/**
 * Lecture du référentiel des divisions (niveaux de match). Données globales insérées
 * par migration (§3.4) : pas de propriétaire, lecture seule pour l'application.
 */
import { z } from "zod";
import type { Queryable } from "./users";

export const divisionCategorySchema = z.enum(["Departemental", "Regional", "National", "Pro"]);
export const divisionTypeSchema = z.enum(["Masculin", "Feminin"]);
export const divisionLevelSchema = z.enum(["U13", "U15", "U18", "U21", "1", "2", "3", "Seniors"]);
/** Tour d'un match de coupe (§15.4.6), du plus lointain à la finale. */
export const cupRoundSchema = z.enum(["R64", "R32", "R16", "R8", "R4", "R2", "F"]);

export type DivisionCategory = z.infer<typeof divisionCategorySchema>;
export type DivisionType = z.infer<typeof divisionTypeSchema>;
export type DivisionLevel = z.infer<typeof divisionLevelSchema>;
export type CupRound = z.infer<typeof cupRoundSchema>;

/** Tours dans l'ordre de la liste (du plus lointain à la finale). */
export const CUP_ROUNDS: readonly CupRound[] = cupRoundSchema.options;

export type Division = {
  id: string;
  category: DivisionCategory;
  type: DivisionType;
  level: DivisionLevel;
  /** Niveau de coupe (§15.4.6) : en bas de la liste, avec un tour sur chaque match. */
  cup: boolean;
  /**
   * Niveau de plateau (§15.4.7) : plusieurs matchs chez un club organisateur, en bas de la
   * liste avant les coupes, proposé seulement de juillet à octobre.
   */
  plateau: boolean;
};

const divisionRowSchema = z.object({
  id: z.uuid(),
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  cup: z.boolean(),
  plateau: z.boolean(),
});

// Les types énumérés se trient dans l'ordre de leur déclaration (Départemental → Pro).
// Championnats, puis plateaux, puis coupes (false < true) : en bas de la liste.
const LIST_DIVISIONS_SQL = `SELECT id, division, type, level, cup, plateau
FROM division
ORDER BY cup, plateau, division, type, level`;

/** Toutes les divisions, de la plus locale à la plus haute, puis les plateaux et les coupes. */
export async function listDivisions(db: Queryable): Promise<Division[]> {
  const result = await db.query(LIST_DIVISIONS_SQL, []);
  return result.rows.map((raw) => {
    const row = divisionRowSchema.parse(raw);
    return {
      id: row.id,
      category: row.division,
      type: row.type,
      level: row.level,
      cup: row.cup,
      plateau: row.plateau,
    };
  });
}

const frequentDivisionRowSchema = z.object({ division_id: z.uuid() });

// Indemnités actives des 12 derniers mois et à venir (index compensation_user_starts_at_idx).
// À égalité, le niveau arbitré le plus récemment passe devant.
const LIST_FREQUENT_DIVISION_IDS_SQL = `SELECT division_id
FROM compensation
WHERE user_id = $1
  AND deleted_at IS NULL
  AND starts_at >= now() - interval '12 months'
GROUP BY division_id
ORDER BY count(*) DESC, max(starts_at) DESC
LIMIT $2`;

/**
 * Niveaux les plus saisis par l'utilisateur sur ses indemnités des 12 derniers mois, du plus
 * fréquent au moins fréquent : ils remontent en tête de la liste des niveaux.
 */
export async function listFrequentDivisionIds(
  db: Queryable,
  userId: string,
  limit: number,
): Promise<string[]> {
  const result = await db.query(LIST_FREQUENT_DIVISION_IDS_SQL, [userId, limit]);
  return result.rows.map((raw) => frequentDivisionRowSchema.parse(raw).division_id);
}

const DIVISION_KIND_SQL = `SELECT cup, plateau FROM division WHERE id = $1`;

const divisionKindRowSchema = z.object({ cup: z.boolean(), plateau: z.boolean() });

/** Nature d'une division (coupe, plateau, sinon championnat). */
export type DivisionKind = { cup: boolean; plateau: boolean };

/**
 * Nature d'une division si elle existe dans le référentiel global, `null` sinon. Sert à
 * vérifier le niveau d'un match : tour de coupe (§15.4.6), équipe 2 et nombre de matchs
 * d'un plateau (§15.4.7).
 */
export async function findDivisionKind(
  db: Queryable,
  divisionId: string,
): Promise<DivisionKind | null> {
  const result = await db.query(DIVISION_KIND_SQL, [divisionId]);
  const raw: unknown = result.rows[0];
  return raw === undefined ? null : divisionKindRowSchema.parse(raw);
}
