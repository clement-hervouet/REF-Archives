/**
 * Barème présélectionné à la saisie d'une indemnité. Pur : ni base, ni React.
 * Règle (bloc 5) : le barème que l'utilisateur a associé au niveau du match, sinon
 * le barème commun. L'utilisateur peut toujours en choisir un autre.
 */

/** Ligne `level_default_scale` : un niveau (division) associé à un barème de l'utilisateur. */
type LevelDefault = {
  divisionId: string;
  scaleId: string;
};

export type ResolveDefaultScaleInput = {
  /** Niveau du match. */
  divisionId: string;
  /** Défauts de l'utilisateur, déjà filtrés par propriétaire. */
  levelDefaults: readonly LevelDefault[];
  /** Identifiant du barème commun. */
  commonScaleId: string;
  /**
   * Barèmes que l'utilisateur peut encore choisir (les siens non supprimés et le commun).
   * Un défaut qui pointe hors de cette liste est ignoré, par prudence.
   */
  selectableScaleIds: ReadonlySet<string>;
};

/** Identifiant du barème présélectionné pour le niveau du match. */
export function resolveDefaultScaleId(input: ResolveDefaultScaleInput): string {
  const chosen = input.levelDefaults.find((entry) => entry.divisionId === input.divisionId);
  if (chosen !== undefined && input.selectableScaleIds.has(chosen.scaleId)) {
    return chosen.scaleId;
  }
  return input.commonScaleId;
}
