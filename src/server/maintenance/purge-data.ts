/**
 * Purge planifiée des données (bloc 11, §5.6 et §9) : efface définitivement les données en
 * soft delete au-delà du délai de conservation, et les lignes techniques devenues inutiles
 * (journal de sécurité ancien, réservations de rappels, sessions, invitations, liens de
 * réinitialisation, compteurs de rate limiting).
 *
 * Une seule transaction : tout passe ou rien ne passe, et le passage du lendemain reprend
 * ce qui a échoué. Idempotent : un second passage le même jour n'efface rien. Appelée
 * chaque jour par la route `/api/cron/purge-data`.
 */
import { RATE_LIMIT_MEMORY_MS } from "../auth/rate-limit-policy";
import {
  purgeArchivedScales,
  purgeDeletedCompensations,
  purgeDeletedGames,
  purgeDeletedNotes,
  purgeEndedInvitations,
  purgeEndedSessions,
  purgeExpiredPasswordResets,
  purgeForgottenRateLimits,
  purgeOldReminderDispatches,
  purgeOldSecurityEvents,
} from "../db/purge";
import type { Queryable } from "../db/users";
import {
  ENDED_INVITATION_RETENTION_DAYS,
  ENDED_SESSION_RETENTION_DAYS,
  REMINDER_DISPATCH_RETENTION_DAYS,
  SECURITY_EVENT_RETENTION_DAYS,
  SOFT_DELETE_RETENTION_DAYS,
} from "./retention";

type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

export type PurgeDataDeps = { transaction: Transaction };

/** Nombre de lignes effacées par catégorie (aucun identifiant ni contenu). */
export type PurgeDataResult = {
  compensations: number;
  notes: number;
  games: number;
  scales: number;
  securityEvents: number;
  reminderDispatches: number;
  sessions: number;
  invitations: number;
  passwordResets: number;
  rateLimits: number;
};

/** Données métier en soft delete. L'ordre compte : les indemnités avant les barèmes. */
async function purgeSoftDeleted(db: Queryable) {
  const compensations = await purgeDeletedCompensations(db, SOFT_DELETE_RETENTION_DAYS);
  const notes = await purgeDeletedNotes(db, SOFT_DELETE_RETENTION_DAYS);
  const games = await purgeDeletedGames(db, SOFT_DELETE_RETENTION_DAYS);
  const scales = await purgeArchivedScales(db, SOFT_DELETE_RETENTION_DAYS);
  return { compensations, notes, games, scales };
}

/** Lignes techniques : journal, rappels, sessions, invitations, jetons, compteurs. */
async function purgeTechnical(db: Queryable) {
  return {
    securityEvents: await purgeOldSecurityEvents(db, SECURITY_EVENT_RETENTION_DAYS),
    reminderDispatches: await purgeOldReminderDispatches(db, REMINDER_DISPATCH_RETENTION_DAYS),
    sessions: await purgeEndedSessions(db, ENDED_SESSION_RETENTION_DAYS),
    invitations: await purgeEndedInvitations(db, ENDED_INVITATION_RETENTION_DAYS),
    passwordResets: await purgeExpiredPasswordResets(db),
    rateLimits: await purgeForgottenRateLimits(db, RATE_LIMIT_MEMORY_MS / 1000),
  };
}

export async function runPurgeData(deps: PurgeDataDeps): Promise<PurgeDataResult> {
  return deps.transaction(async (db) => ({
    ...(await purgeSoftDeleted(db)),
    ...(await purgeTechnical(db)),
  }));
}
