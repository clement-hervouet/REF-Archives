/**
 * Le compte `userIdColumn` n'a pas de suppression programmée (`deletion_due_at`, voir
 * `account-state.ts`). Un compte en cours de suppression ne partage plus rien et ne reçoit
 * plus rien. Alias fixe, jamais saisi.
 */
export function notBeingDeleted(userIdColumn: string): string {
  return `NOT EXISTS (SELECT 1 FROM "user" deleting
    WHERE deleting.id = ${userIdColumn} AND deleting.deletion_due_at IS NOT NULL)`;
}

/**
 * Règle d'accès d'une préparation partagée (migration 035) : SEULE exception à l'isolation
 * par compte (§6.2). Toute requête qui lit ou écrit pour un destinataire la reprend.
 *
 * Un partage `s` (game_share) du match `g` est valide si, à cet instant :
 *  * il vise bien un match de son propriétaire, actif (pas supprimé) et hors plateau ;
 *  * la fiche partagée est encore arbitre 1, 2 ou 3 du match ;
 *  * cette fiche est encore liée (`l`, colleague_link) au compte destinataire du partage ;
 *  * aucun des deux comptes n'a de suppression programmée.
 * Délier, retirer l'arbitre du match, supprimer le match ou programmer la suppression d'un
 * des deux comptes coupe donc l'accès sans autre code de révocation (annuler la suppression
 * le rétablit).
 *
 * Usage : `FROM ${SHARE_FROM} … WHERE ${VALID_SHARE} AND …`, ou
 * `EXISTS (SELECT 1 FROM game_share s, colleague_link l WHERE ${VALID_SHARE})` depuis une
 * requête qui lit déjà `game g`. Le destinataire se filtre avec `s.recipient_user_id`.
 */
export const VALID_SHARE = `(g.id = s.game_id AND g.user_id = s.owner_user_id
  AND g.deleted_at IS NULL AND g.team2_id IS NOT NULL
  AND s.person_id IN (g.referee1_id, g.referee2_id, g.referee3_id)
  AND l.owner_user_id = s.owner_user_id AND l.person_id = s.person_id
  AND l.linked_user_id = s.recipient_user_id
  AND ${notBeingDeleted("s.owner_user_id")} AND ${notBeingDeleted("s.recipient_user_id")})`;

/** Tables d'un partage (`s`), de son match (`g`) et du lien de la fiche (`l`). */
export const SHARE_FROM = `game_share s
JOIN game g ON g.id = s.game_id
JOIN colleague_link l ON l.owner_user_id = s.owner_user_id AND l.person_id = s.person_id`;
