/**
 * Lecture de toutes les données d'un compte pour l'export RGPD (bloc 11, §6.5).
 *
 * Une seule requête, filtrée par propriétaire à chaque sous-requête (§5.6), qui construit
 * directement le document JSON avec des colonnes listées une à une : un champ ajouté plus
 * tard à une table n'entre jamais dans l'export par accident. Ne sortent jamais : le hash
 * du mot de passe, les empreintes de jetons (invitation, réinitialisation, flux iCal) et
 * les empreintes d'IP du journal.
 *
 * Les données supprimées mais pas encore purgées (soft delete) sont incluses, avec leur
 * `deletedAt` : elles sont encore stockées, donc elles font partie du droit d'accès.
 */
import { z } from "zod";
import type { Queryable } from "./users";

const DIVISION_JSON = `json_build_object('division', d.division, 'type', d.type, 'level', d.level)`;

const ACCOUNT_SQL = `(SELECT json_build_object(
    'id', u.id, 'email', u.email, 'firstname', u.firstname, 'lastname', u.lastname,
    'role', u.role, 'createdAt', u.created_at, 'updatedAt', u.updated_at,
    'availabilityReminderEnabled', u.availability_reminder_enabled,
    'availabilityReminderWeeks', u.availability_reminder_weeks,
    'weekendRecapEnabled', u.weekend_recap_enabled,
    'availabilityAcknowledgedWeek', u.availability_ack_week,
    'blockedAt', u.blocked_at, 'blockedUntil', u.blocked_until,
    'deletionDueAt', u.deletion_due_at)
  FROM "user" u WHERE u.id = $1)`;

/** Liste JSON, vide plutôt que NULL quand il n'y a aucune ligne. */
function list(select: string): string {
  return `coalesce((${select}), '[]'::json)`;
}

const ADDRESSES_SQL = list(`SELECT json_agg(json_build_object(
    'id', a.id, 'number', a.number, 'street', a.street, 'postalCode', a.postal_code,
    'city', a.city, 'country', a.country, 'createdAt', a.created_at, 'updatedAt', a.updated_at)
    ORDER BY a.created_at, a.id)
  FROM address a WHERE a.user_id = $1`);

const CLUBS_SQL = list(`SELECT json_agg(json_build_object(
    'id', c.id, 'name', c.name, 'licence', c.licence, 'addressId', c.address_id,
    'correspondentId', c.correspondent_id, 'createdAt', c.created_at, 'updatedAt', c.updated_at)
    ORDER BY c.name, c.id)
  FROM club c WHERE c.user_id = $1`);

const TEAMS_SQL = list(`SELECT json_agg(json_build_object(
    'id', t.id, 'clubId', t.club_id, 'division', ${DIVISION_JSON},
    'createdAt', t.created_at, 'updatedAt', t.updated_at)
    ORDER BY t.created_at, t.id)
  FROM team t JOIN division d ON d.id = t.division_id WHERE t.user_id = $1`);

const PERSONS_SQL = list(`SELECT json_agg(json_build_object(
    'id', p.id, 'type', p.type, 'isSelf', p.is_self, 'firstname', p.firstname,
    'lastname', p.lastname, 'licence', p.licence, 'email', p.email, 'phone', p.phone,
    'addressId', p.address_id, 'clubId', p.club_id, 'hasAccount', p.has_account,
    'createdAt', p.created_at, 'updatedAt', p.updated_at)
    ORDER BY p.lastname, p.firstname, p.id)
  FROM person p WHERE p.user_id = $1`);

// Le barème commun n'appartient à personne : il n'est pas exporté en tant que barème, mais
// chaque indemnité porte la ligne de barème qu'elle utilise (voir COMPENSATIONS_SQL).
const SCALES_SQL = list(`SELECT json_agg(json_build_object(
    'id', s.id, 'name', s.name, 'createdAt', s.created_at, 'updatedAt', s.updated_at,
    'deletedAt', s.deleted_at,
    'rates', ${list(`SELECT json_agg(json_build_object(
        'id', r.id, 'effectiveFrom', r.effective_from, 'gameAmountCents', r.game_amount_cents,
        'centsPerKm', r.cents_per_km, 'createdAt', r.created_at)
        ORDER BY r.effective_from)
      FROM scale_rate r WHERE r.scale_id = s.id`)})
    ORDER BY s.name, s.id)
  FROM scale s WHERE s.user_id = $1`);

const LEVEL_DEFAULT_SCALES_SQL = list(`SELECT json_agg(json_build_object(
    'division', ${DIVISION_JSON}, 'scaleId', l.scale_id,
    'createdAt', l.created_at, 'updatedAt', l.updated_at)
    ORDER BY d.division, d.type, d.level)
  FROM level_default_scale l JOIN division d ON d.id = l.division_id WHERE l.user_id = $1`);

const GAMES_SQL = list(`SELECT json_agg(json_build_object(
    'id', g.id, 'startsAt', g.starts_at, 'division', ${DIVISION_JSON},
    'addressId', g.address_id, 'team1Id', g.team1_id, 'team2Id', g.team2_id,
    'referee1Id', g.referee1_id, 'referee2Id', g.referee2_id, 'referee3Id', g.referee3_id,
    'observerId', g.observer_id, 'createdAt', g.created_at, 'updatedAt', g.updated_at,
    'deletedAt', g.deleted_at)
    ORDER BY g.starts_at, g.id)
  FROM game g JOIN division d ON d.id = g.division_id WHERE g.user_id = $1`);

const NOTES_SQL = list(`SELECT json_agg(json_build_object(
    'id', n.id, 'gameId', n.game_id, 'body', n.body, 'confidence', n.confidence,
    'stress', n.stress, 'management', n.management, 'judgment', n.judgment,
    'createdAt', n.created_at, 'updatedAt', n.updated_at, 'deletedAt', n.deleted_at,
    'clips', ${list(`SELECT json_agg(json_build_object(
        'position', k.position, 'url', k.url, 'createdAt', k.created_at)
        ORDER BY k.position)
      FROM note_clip k WHERE k.note_id = n.id AND k.user_id = $1`)})
    ORDER BY n.created_at, n.id)
  FROM note n WHERE n.user_id = $1`);

// La ligne de barème est jointe sans filtre de propriétaire : elle peut appartenir au barème
// commun. L'indemnité, elle, est filtrée par propriétaire.
const COMPENSATIONS_SQL = list(`SELECT json_agg(json_build_object(
    'id', c.id, 'gameId', c.game_id, 'startsAt', c.starts_at, 'division', ${DIVISION_JSON},
    'team1Id', c.team1_id, 'team2Id', c.team2_id, 'addressId', c.address_id,
    'distanceMeters', c.distance_m, 'payer', c.payer, 'paidOn', c.paid_on,
    'scaleRate', json_build_object(
      'id', r.id, 'scaleId', s.id, 'scaleName', s.name, 'effectiveFrom', r.effective_from,
      'gameAmountCents', r.game_amount_cents, 'centsPerKm', r.cents_per_km),
    'createdAt', c.created_at, 'updatedAt', c.updated_at, 'deletedAt', c.deleted_at)
    ORDER BY c.starts_at, c.id)
  FROM compensation c
  JOIN division d ON d.id = c.division_id
  JOIN scale_rate r ON r.id = c.scale_rate_id
  JOIN scale s ON s.id = r.scale_id
  WHERE c.user_id = $1`);

// Seule la date de création : l'URL du flux n'est pas stockée, et son empreinte ne sort pas.
const CALENDAR_FEED_SQL = `(SELECT json_build_object('createdAt', f.created_at)
  FROM calendar_feed f WHERE f.user_id = $1)`;

const SESSIONS_SQL = list(`SELECT json_agg(json_build_object(
    'createdAt', se.created_at, 'lastSeenAt', se.last_seen_at,
    'expiresAt', se.expires_at, 'revokedAt', se.revoked_at)
    ORDER BY se.created_at)
  FROM session se WHERE se.user_id = $1`);

// Événements dont le compte est l'auteur ou la cible (action d'un admin sur lui). Ni
// empreinte d'IP, ni identifiant de l'autre compte.
const SECURITY_EVENTS_SQL = list(`SELECT json_agg(json_build_object(
    'type', e.type, 'createdAt', e.created_at,
    'role', CASE WHEN e.user_id = $1 THEN 'author' ELSE 'target' END)
    ORDER BY e.created_at)
  FROM security_event e WHERE e.user_id = $1 OR e.target_user_id = $1`);

const REMINDER_DISPATCHES_SQL = list(`SELECT json_agg(json_build_object(
    'kind', rd.kind, 'periodStart', rd.period_start, 'sentAt', rd.sent_at)
    ORDER BY rd.sent_at)
  FROM reminder_dispatch rd WHERE rd.user_id = $1`);

const DATA_EXPORT_SQL = `SELECT json_build_object(
  'account', ${ACCOUNT_SQL},
  'addresses', ${ADDRESSES_SQL},
  'clubs', ${CLUBS_SQL},
  'teams', ${TEAMS_SQL},
  'persons', ${PERSONS_SQL},
  'scales', ${SCALES_SQL},
  'levelDefaultScales', ${LEVEL_DEFAULT_SCALES_SQL},
  'games', ${GAMES_SQL},
  'notes', ${NOTES_SQL},
  'compensations', ${COMPENSATIONS_SQL},
  'calendarFeed', ${CALENDAR_FEED_SQL},
  'sessions', ${SESSIONS_SQL},
  'securityEvents', ${SECURITY_EVENTS_SQL},
  'reminderDispatches', ${REMINDER_DISPATCHES_SQL}
) AS data`;

// Le contenu de chaque élément est construit par le SQL ci-dessus, colonne par colonne ;
// Zod vérifie la forme générale (sections attendues, listes d'objets).
const jsonObject = z.record(z.string(), z.unknown());
const jsonList = z.array(jsonObject);

const dataExportSchema = z.object({
  account: jsonObject.nullable(),
  addresses: jsonList,
  clubs: jsonList,
  teams: jsonList,
  persons: jsonList,
  scales: jsonList,
  levelDefaultScales: jsonList,
  games: jsonList,
  notes: jsonList,
  compensations: jsonList,
  calendarFeed: jsonObject.nullable(),
  sessions: jsonList,
  securityEvents: jsonList,
  reminderDispatches: jsonList,
});

const rowSchema = z.object({ data: dataExportSchema });

type RawDataExport = z.infer<typeof dataExportSchema>;

/** Toutes les données d'un compte, section par section. */
export type UserDataExport = Omit<RawDataExport, "account"> & {
  account: Record<string, unknown>;
};

/** Données du compte pour l'export, ou `null` si le compte n'existe pas. */
export async function readUserDataExport(
  db: Queryable,
  userId: string,
): Promise<UserDataExport | null> {
  const result = await db.query(DATA_EXPORT_SQL, [userId]);
  const { data } = rowSchema.parse(result.rows[0]);
  if (data.account === null) {
    return null;
  }
  return { ...data, account: data.account };
}
