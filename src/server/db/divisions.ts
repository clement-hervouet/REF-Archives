/**
 * Lecture du référentiel des divisions (niveaux de match). Données globales insérées
 * par migration (§3.4) : pas de propriétaire, lecture seule pour l'application.
 */
import { z } from "zod";
import type { Queryable } from "./users";

export const divisionCategorySchema = z.enum(["Departemental", "Regional", "National", "Pro"]);
export const divisionTypeSchema = z.enum(["Masculin", "Feminin"]);
export const divisionLevelSchema = z.enum(["U13", "U15", "U18", "U21", "1", "2", "3"]);

export type DivisionCategory = z.infer<typeof divisionCategorySchema>;
export type DivisionType = z.infer<typeof divisionTypeSchema>;
export type DivisionLevel = z.infer<typeof divisionLevelSchema>;

export type Division = {
  id: string;
  category: DivisionCategory;
  type: DivisionType;
  level: DivisionLevel;
};

const divisionRowSchema = z.object({
  id: z.uuid(),
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
});

// Les types énumérés se trient dans l'ordre de leur déclaration (Départemental → Pro).
const LIST_DIVISIONS_SQL = `SELECT id, division, type, level
FROM division
ORDER BY division, type, level`;

/** Toutes les divisions, de la plus locale à la plus haute. */
export async function listDivisions(db: Queryable): Promise<Division[]> {
  const result = await db.query(LIST_DIVISIONS_SQL, []);
  return result.rows.map((raw) => {
    const row = divisionRowSchema.parse(raw);
    return { id: row.id, category: row.division, type: row.type, level: row.level };
  });
}