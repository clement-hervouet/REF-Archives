/**
 * État d'un compte (bloc 10, migration 018) : actif, bloqué ou en attente de suppression.
 * La condition SQL « compte actif » vit ici et nulle part ailleurs : session, connexion,
 * emails de rappel et flux iCal l'utilisent tous.
 */

/** Colonnes d'état d'un compte telles que lues en base. */
export type AccountStateColumns = {
  blockedAt: Date | null;
  blockedUntil: Date | null;
  deletionDueAt: Date | null;
};

/** Pourquoi un compte est coupé. `until: null` = jusqu'à déblocage par un admin. */
export type AccountSuspension =
  { kind: "blocked"; until: Date | null } | { kind: "deletion"; dueAt: Date };

/**
 * Condition « compte actif » sur la table "user" aliasée `u`. `blocked_until <= now()`
 * vaut NULL (donc faux) pour un blocage sans fin : le compte reste bloqué.
 */
export const ACTIVE_ACCOUNT_CONDITION =
  "(u.blocked_at IS NULL OR u.blocked_until <= now()) AND u.deletion_due_at IS NULL";

/** Même règle qu'`ACTIVE_ACCOUNT_CONDITION`, en TypeScript ; `null` si le compte est actif. */
export function accountSuspension(state: AccountStateColumns, now: Date): AccountSuspension | null {
  // La suppression programmée passe avant le blocage : c'est elle qui sera appliquée.
  if (state.deletionDueAt !== null) {
    return { kind: "deletion", dueAt: state.deletionDueAt };
  }
  if (state.blockedAt === null) {
    return null;
  }
  if (state.blockedUntil !== null && state.blockedUntil.getTime() <= now.getTime()) {
    return null;
  }
  return { kind: "blocked", until: state.blockedUntil };
}
