/**
 * Requêtes SQL des rappels (bloc 7) : réglages de chaque utilisateur (colonnes de
 * `"user"`) et réservation des envois dans `reminder_dispatch`.
 *
 * Idempotence (§9) : le job réserve la ligne (utilisateur, type, période) AVANT d'envoyer.
 * Deux exécutions simultanées ne peuvent pas toutes deux réussir l'INSERT : un rappel
 * ne part jamais deux fois. Si l'envoi échoue, la réservation est libérée pour réessayer
 * au passage suivant.
 */
import { z } from "zod";
import { assertIsoDate } from "@/lib/dates";
import type { ReminderSettings } from "@/server/reminders/schedule";
import type { Queryable } from "./users";

export const reminderKindSchema = z.enum(["availability", "weekend_recap"]);
export type ReminderKind = z.infer<typeof reminderKindSchema>;

/** Taille d'une page de destinataires lue par le job. */
export const REMINDER_RECIPIENTS_PAGE_SIZE = 500;

export type ReminderRecipient = {
  userId: string;
  email: string;
  settings: ReminderSettings;
};

export type ReminderDispatchKey = {
  userId: string;
  kind: ReminderKind;
  /** Jour calendaire de Paris `AAAA-MM-JJ` (voir la migration 011). */
  periodStart: string;
};

const settingsRowSchema = z.object({
  availability_reminder_enabled: z.boolean(),
  availability_reminder_weeks: z.number().int(),
  weekend_recap_enabled: z.boolean(),
});

const recipientRowSchema = settingsRowSchema.extend({
  id: z.uuid(),
  email: z.string(),
});

const GET_SETTINGS_SQL = `SELECT availability_reminder_enabled, availability_reminder_weeks,
  weekend_recap_enabled
FROM "user"
WHERE id = $1`;

const UPDATE_SETTINGS_SQL = `UPDATE "user"
SET availability_reminder_enabled = $2, availability_reminder_weeks = $3,
  weekend_recap_enabled = $4
WHERE id = $1
RETURNING id`;

// Pagination par clé (id > dernier id vu) : stable même si des comptes sont créés
// pendant le job, et sans OFFSET qui relit les lignes déjà parcourues.
const LIST_RECIPIENTS_SQL = `SELECT id, email, availability_reminder_enabled,
  availability_reminder_weeks, weekend_recap_enabled
FROM "user"
WHERE (availability_reminder_enabled OR weekend_recap_enabled)
  AND ($1::uuid IS NULL OR id > $1::uuid)
ORDER BY id
LIMIT $2`;

const CLAIM_DISPATCH_SQL = `INSERT INTO reminder_dispatch (user_id, kind, period_start)
VALUES ($1, $2, $3::date)
ON CONFLICT (user_id, kind, period_start) DO NOTHING
RETURNING user_id`;

const RELEASE_DISPATCH_SQL = `DELETE FROM reminder_dispatch
WHERE user_id = $1 AND kind = $2 AND period_start = $3::date`;

function toSettings(row: z.infer<typeof settingsRowSchema>): ReminderSettings {
  return {
    availabilityReminderEnabled: row.availability_reminder_enabled,
    availabilityReminderWeeks: row.availability_reminder_weeks,
    weekendRecapEnabled: row.weekend_recap_enabled,
  };
}

function dispatchValues(key: ReminderDispatchKey): unknown[] {
  assertIsoDate(key.periodStart);
  return [key.userId, key.kind, key.periodStart];
}

/** Réglages de rappel d'un utilisateur ; `null` si le compte n'existe pas. */
export async function getReminderSettings(
  db: Queryable,
  userId: string,
): Promise<ReminderSettings | null> {
  const result = await db.query(GET_SETTINGS_SQL, [userId]);
  const row = result.rows[0];
  return row === undefined ? null : toSettings(settingsRowSchema.parse(row));
}

/** Enregistre les réglages (déjà validés). Renvoie `false` si le compte n'existe pas. */
export async function updateReminderSettings(
  db: Queryable,
  userId: string,
  settings: ReminderSettings,
): Promise<boolean> {
  const result = await db.query(UPDATE_SETTINGS_SQL, [
    userId,
    settings.availabilityReminderEnabled,
    settings.availabilityReminderWeeks,
    settings.weekendRecapEnabled,
  ]);
  return result.rows.length > 0;
}

/**
 * Une page de comptes ayant au moins un rappel activé, triés par id. Passer le dernier
 * id reçu dans `afterUserId` pour la page suivante ; une page incomplète est la dernière.
 */
export async function listReminderRecipients(
  db: Queryable,
  input: { afterUserId: string | null; limit?: number },
): Promise<ReminderRecipient[]> {
  const limit = input.limit ?? REMINDER_RECIPIENTS_PAGE_SIZE;
  const result = await db.query(LIST_RECIPIENTS_SQL, [input.afterUserId, limit]);
  return result.rows.map((raw) => {
    const row = recipientRowSchema.parse(raw);
    return { userId: row.id, email: row.email, settings: toSettings(row) };
  });
}

/** Réserve un envoi. Renvoie `false` s'il a déjà été réservé (déjà envoyé ou en cours). */
export async function claimReminderDispatch(
  db: Queryable,
  key: ReminderDispatchKey,
): Promise<boolean> {
  const result = await db.query(CLAIM_DISPATCH_SQL, dispatchValues(key));
  return result.rows.length > 0;
}

/** Libère une réservation après un échec d'envoi, pour réessayer au passage suivant. */
export async function releaseReminderDispatch(
  db: Queryable,
  key: ReminderDispatchKey,
): Promise<void> {
  await db.query(RELEASE_DISPATCH_SQL, dispatchValues(key));
}
