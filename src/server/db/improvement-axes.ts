/**
 * Requêtes SQL des axes d'amélioration : une fiche par utilisateur (clé `user_id`),
 * indépendante des matchs. Chaque requête filtre sur `user_id` (§6.2).
 */
import { z } from "zod";
import type { ImprovementAxes } from "@/lib/schemas/improvement-axes";
import type { Queryable } from "./users";

export type StoredImprovementAxes = ImprovementAxes & { updatedAt: Date };

// Crée la fiche ou la remplace entièrement.
const UPSERT_IMPROVEMENT_AXES_SQL = `INSERT INTO improvement_axes (user_id, mechanics_ak,
  mechanics_at, mechanics_transitions, decision_making, signals, foul_judgment,
  violation_judgment)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (user_id)
DO UPDATE SET
  mechanics_ak = EXCLUDED.mechanics_ak, mechanics_at = EXCLUDED.mechanics_at,
  mechanics_transitions = EXCLUDED.mechanics_transitions,
  decision_making = EXCLUDED.decision_making, signals = EXCLUDED.signals,
  foul_judgment = EXCLUDED.foul_judgment, violation_judgment = EXCLUDED.violation_judgment`;

/** Écrit (crée ou remplace) la fiche des axes d'amélioration de l'utilisateur. */
export async function saveImprovementAxes(
  db: Queryable,
  input: { userId: string; axes: ImprovementAxes },
): Promise<void> {
  const { axes } = input;
  await db.query(UPSERT_IMPROVEMENT_AXES_SQL, [
    input.userId,
    axes.mechanicsAk,
    axes.mechanicsAt,
    axes.mechanicsTransitions,
    axes.decisionMaking,
    axes.signals,
    axes.foulJudgment,
    axes.violationJudgment,
  ]);
}

const FIND_IMPROVEMENT_AXES_SQL = `SELECT updated_at, mechanics_ak, mechanics_at,
  mechanics_transitions, decision_making, signals, foul_judgment, violation_judgment
FROM improvement_axes
WHERE user_id = $1`;

const text = z.string().nullable();

const rowSchema = z.object({
  updated_at: z.date(),
  mechanics_ak: text,
  mechanics_at: text,
  mechanics_transitions: text,
  decision_making: text,
  signals: text,
  foul_judgment: text,
  violation_judgment: text,
});

/** Fiche des axes d'amélioration de l'utilisateur, ou `null` s'il n'en a jamais enregistré. */
export async function findImprovementAxes(
  db: Queryable,
  userId: string,
): Promise<StoredImprovementAxes | null> {
  const result = await db.query(FIND_IMPROVEMENT_AXES_SQL, [userId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = rowSchema.parse(raw);
  return {
    updatedAt: row.updated_at,
    mechanicsAk: row.mechanics_ak,
    mechanicsAt: row.mechanics_at,
    mechanicsTransitions: row.mechanics_transitions,
    decisionMaking: row.decision_making,
    signals: row.signals,
    foulJudgment: row.foul_judgment,
    violationJudgment: row.violation_judgment,
  };
}
