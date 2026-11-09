/**
 * Durées de conservation de la purge planifiée (bloc 11, décidées au début du bloc).
 *
 * Elles vivent ici et nulle part ailleurs : la purge les passe en paramètre aux requêtes
 * de `src/server/db/purge.ts`. Changer une durée = changer cette constante.
 */

/** Indemnités, matchs, notes et barèmes supprimés : délai avant l'effacement définitif. */
export const SOFT_DELETE_RETENTION_DAYS = 30;

/** Journal des événements de sécurité (§6.1). */
export const SECURITY_EVENT_RETENTION_DAYS = 90;

/**
 * Réservations d'envoi des rappels. Une réservation ne sert qu'à éviter un doublon pendant
 * sa période (une semaine au plus) : 30 jours laissent une large marge.
 */
export const REMINDER_DISPATCH_RETENTION_DAYS = 30;

/**
 * Sessions expirées ou révoquées : gardées un peu pour la « dernière activité » de la page
 * admin « Comptes », puis effacées.
 */
export const ENDED_SESSION_RETENTION_DAYS = 30;

/** Invitations acceptées, révoquées ou expirées : elles contiennent un email. */
export const ENDED_INVITATION_RETENTION_DAYS = 30;
