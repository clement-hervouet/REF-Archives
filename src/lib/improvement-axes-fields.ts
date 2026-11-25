/**
 * Constantes des axes d'amélioration, partagées par le client (formulaire) et le serveur
 * (schéma, lecture du FormData, requêtes). Sans dépendance : ni Zod ni code serveur n'est
 * embarqué dans le bundle client.
 */

/** Les axes, dans l'ordre d'affichage. Chaque nom est aussi celui du champ HTML. */
export const IMPROVEMENT_AXES = [
  "mechanicsAk",
  "mechanicsAt",
  "mechanicsTransitions",
  "decisionMaking",
  "signals",
  "foulJudgment",
  "violationJudgment",
] as const;
export type ImprovementAxis = (typeof IMPROVEMENT_AXES)[number];

/** Borne alignée sur la migration 033 (`improvement_axes`). */
export const IMPROVEMENT_TEXT_MAX = 4096;
