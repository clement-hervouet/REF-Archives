/**
 * Constantes des axes d'amélioration, partagées par le client (formulaires) et le serveur
 * (schéma, lecture du FormData, requêtes). Sans dépendance : ni Zod ni code serveur n'est
 * embarqué dans le bundle client.
 */

/** Les axes par défaut, dans leur ordre de départ. */
export const IMPROVEMENT_AXES = [
  "mechanicsAk",
  "mechanicsAt",
  "mechanicsTransitions",
  "decisionMaking",
  "signals",
  "foulJudgment",
  "violationJudgment",
  "management",
] as const;
export type ImprovementAxis = (typeof IMPROVEMENT_AXES)[number];

/**
 * Un axe dans l'ordre d'affichage de l'utilisateur : axe par défaut (`defaultKey`, libellé
 * traduit) ou catégorie personnelle (`label`). Un axe par défaut supprimé reste dans la liste,
 * masqué (`hidden`, texte vide), pour pouvoir être rétabli. `slot` l'identifie dans les formulaires (nom
 * du champ texte, valeur envoyée pour l'ordre) : la clé de l'axe par défaut, ou l'identifiant
 * de la catégorie.
 */
export type ImprovementAxisItem =
  | {
      slot: string;
      defaultKey: ImprovementAxis;
      label: null;
      body: string | null;
      hidden: boolean;
    }
  | { slot: string; defaultKey: null; label: string; body: string | null; hidden: false };

/** Bornes alignées sur les migrations 036 à 038 (`improvement_axis`). */
export const IMPROVEMENT_TEXT_MAX = 4096;
export const IMPROVEMENT_LABEL_MAX = 60;

/** Nombre de catégories personnelles par utilisateur (en plus des axes par défaut). */
export const IMPROVEMENT_CUSTOM_MAX = 20;
