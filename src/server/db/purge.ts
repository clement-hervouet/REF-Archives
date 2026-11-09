/**
 * Requêtes de la purge planifiée (bloc 11) : effacement définitif de ce qui n'a plus à être
 * conservé. Appelées par `runPurgeData` (`src/server/maintenance/purge-data.ts`), dans une
 * transaction, par un job système.
 *
 * Exception assumée au §5.6 (« toute requête est filtrée par propriétaire ») : ce job agit
 * pour tous les comptes et n'est jamais déclenché par un utilisateur. Les durées viennent
 * de `src/server/maintenance/retention.ts` et passent en paramètre, jamais dans le texte.
 *
 * Chaque fonction renvoie le nombre de lignes effacées, et une seconde exécution n'efface
 * rien (idempotence).
 */
import { z } from "zod";
import type { Queryable } from "./users";

const countRowSchema = z.object({ count: z.number().int().nonnegative() });

/** Enveloppe un `DELETE` pour qu'il renvoie une seule ligne : le nombre de lignes effacées. */
function counted(deleteSql: string): string {
  return `WITH purged AS (
${deleteSql}
  RETURNING 1
)
SELECT count(*)::integer AS count FROM purged`;
}

const OLDER_THAN_DAYS = `now() - $1::integer * interval '1 day'`;

// Une indemnité supprimée compte encore pour « ligne de barème utilisée » (§3.8) : elle doit
// donc partir AVANT les barèmes archivés (voir `purgeArchivedScales`).
const PURGE_DELETED_COMPENSATIONS_SQL = counted(`  DELETE FROM compensation
  WHERE deleted_at < ${OLDER_THAN_DAYS}`);

// Les extraits liés (`note_clip`) partent par ON DELETE CASCADE.
const PURGE_DELETED_NOTES_SQL = counted(`  DELETE FROM note
  WHERE deleted_at < ${OLDER_THAN_DAYS}`);

// La suppression d'un match a déjà détaché l'indemnité liée (`softDeleteGame`) ; la note
// d'un match supprimé, restée active, part avec lui par ON DELETE CASCADE.
const PURGE_DELETED_GAMES_SQL = counted(`  DELETE FROM game
  WHERE deleted_at < ${OLDER_THAN_DAYS}`);

// Un barème archivé n'est effaçable que si plus aucune indemnité, même supprimée et pas
// encore purgée, ne référence une de ses lignes : sinon la contrainte NO ACTION de
// `compensation.scale_rate_id` ferait échouer toute la purge. Le barème commun n'est jamais
// archivé (contrainte `scale_common_not_deleted_check`) ; la condition sur `user_id` le
// protège quand même. Ses lignes (`scale_rate`) partent par ON DELETE CASCADE.
const PURGE_ARCHIVED_SCALES_SQL = counted(`  DELETE FROM scale s
  WHERE s.user_id IS NOT NULL
    AND s.deleted_at < ${OLDER_THAN_DAYS}
    AND NOT EXISTS (
      SELECT 1
      FROM compensation c
      JOIN scale_rate r ON r.id = c.scale_rate_id
      WHERE r.scale_id = s.id
    )`);

const PURGE_OLD_SECURITY_EVENTS_SQL = counted(`  DELETE FROM security_event
  WHERE created_at < ${OLDER_THAN_DAYS}`);

const PURGE_OLD_REMINDER_DISPATCHES_SQL = counted(`  DELETE FROM reminder_dispatch
  WHERE sent_at < ${OLDER_THAN_DAYS}`);

// Une session n'est plus utilisable dès qu'elle est expirée ou révoquée (`sessions.ts`) ;
// la ligne ne sert plus qu'à la « dernière activité » de la page admin.
const PURGE_ENDED_SESSIONS_SQL = counted(`  DELETE FROM session
  WHERE expires_at < ${OLDER_THAN_DAYS}
     OR revoked_at < ${OLDER_THAN_DAYS}`);

// Fin d'une invitation : son acceptation, sa révocation, sinon son expiration. Une
// invitation encore valable a une expiration future : elle n'est jamais effacée.
const PURGE_ENDED_INVITATIONS_SQL = counted(`  DELETE FROM invitation
  WHERE coalesce(accepted_at, revoked_at, expires_at) < ${OLDER_THAN_DAYS}`);

// Un lien de réinitialisation expiré (utilisé ou non) n'est plus jamais accepté.
const PURGE_EXPIRED_PASSWORD_RESETS_SQL = counted(`  DELETE FROM password_reset
  WHERE expires_at <= now()`);

// Même condition que `isForgotten` (rate-limit-policy.ts) : une ligne effacée équivaut à
// une ligne dont les blocages passés sont oubliés, donc le comportement ne change pas.
// Une connexion en cours qui verrouille la ligne (FOR UPDATE) fait attendre ce DELETE, qui
// réévalue ensuite la condition sur la ligne mise à jour.
const PURGE_FORGOTTEN_RATE_LIMITS_SQL = counted(`  DELETE FROM rate_limit
  WHERE greatest(window_started_at, coalesce(blocked_until, window_started_at))
    <= now() - $1::integer * interval '1 second'`);

async function runCount(db: Queryable, sql: string, values: unknown[]): Promise<number> {
  const result = await db.query(sql, values);
  return countRowSchema.parse(result.rows[0]).count;
}

/** Indemnités supprimées depuis plus de `days` jours. */
export function purgeDeletedCompensations(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_DELETED_COMPENSATIONS_SQL, [days]);
}

/** Notes supprimées depuis plus de `days` jours (et leurs liens de clips). */
export function purgeDeletedNotes(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_DELETED_NOTES_SQL, [days]);
}

/** Matchs supprimés depuis plus de `days` jours (et leur note). */
export function purgeDeletedGames(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_DELETED_GAMES_SQL, [days]);
}

/** Barèmes archivés depuis plus de `days` jours que plus aucune indemnité ne référence. */
export function purgeArchivedScales(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_ARCHIVED_SCALES_SQL, [days]);
}

/** Événements du journal de sécurité de plus de `days` jours. */
export function purgeOldSecurityEvents(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_OLD_SECURITY_EVENTS_SQL, [days]);
}

/** Réservations d'envoi de rappels de plus de `days` jours. */
export function purgeOldReminderDispatches(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_OLD_REMINDER_DISPATCHES_SQL, [days]);
}

/** Sessions expirées ou révoquées depuis plus de `days` jours. */
export function purgeEndedSessions(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_ENDED_SESSIONS_SQL, [days]);
}

/** Invitations acceptées, révoquées ou expirées depuis plus de `days` jours. */
export function purgeEndedInvitations(db: Queryable, days: number): Promise<number> {
  return runCount(db, PURGE_ENDED_INVITATIONS_SQL, [days]);
}

/** Liens de réinitialisation de mot de passe expirés. */
export function purgeExpiredPasswordResets(db: Queryable): Promise<number> {
  return runCount(db, PURGE_EXPIRED_PASSWORD_RESETS_SQL, []);
}

/** Compteurs de rate limiting sans activité depuis `memorySeconds` secondes. */
export function purgeForgottenRateLimits(db: Queryable, memorySeconds: number): Promise<number> {
  return runCount(db, PURGE_FORGOTTEN_RATE_LIMITS_SQL, [memorySeconds]);
}
