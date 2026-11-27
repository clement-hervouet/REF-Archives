/**
 * Lecture de toutes les données d'un compte pour l'export RGPD (bloc 11, §6.5).
 *
 * Une seule requête, filtrée par propriétaire à chaque sous-requête (§5.6), qui construit
 * directement le document JSON avec des colonnes listées une à une : un champ ajouté plus
 * tard à une table n'entre jamais dans l'export par accident. Ne sortent jamais : le hash
 * du mot de passe, les empreintes de jetons (invitation, réinitialisation, flux iCal, lien
 * de partage) et les empreintes d'IP du journal.
 *
 * Préparation partagée (migration 035) : les liens et partages du compte en sortent, mais
 * jamais le contenu d'un autre compte (la préparation partagée par un collègue reste la
 * sienne) ; seuls le prénom et le nom du collègue, que le compte voit déjà, l'accompagnent.
 *
 * Les données supprimées mais pas encore purgées (soft delete) sont incluses, avec leur
 * `deletedAt` : elles sont encore stockées, donc elles font partie du droit d'accès.
 */
import { z } from "zod";
import { VALID_SHARE } from "./share-access";
import type { Queryable } from "./users";

const DIVISION_JSON = `json_build_object('division', d.division, 'type', d.type, 'level', d.level,
  'cup', d.cup)`;

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
    'id', a.id, 'name', a.name, 'number', a.number, 'street', a.street, 'postalCode', a.postal_code,
    'city', a.city, 'country', a.country, 'createdAt', a.created_at, 'updatedAt', a.updated_at)
    ORDER BY a.created_at, a.id)
  FROM address a WHERE a.user_id = $1`);

const CLUBS_SQL = list(`SELECT json_agg(json_build_object(
    'id', c.id, 'name', c.name, 'licence', c.licence, 'addressId', c.address_id,
    'ffbbId', c.ffbb_id, 'ffbbLogoUuid', c.ffbb_logo_uuid, 'color', c.color,
    'otherVenueAddressIds', ${list(`SELECT json_agg(v.address_id ORDER BY v.created_at, v.address_id)
      FROM club_venue v WHERE v.club_id = c.id AND v.user_id = c.user_id`)},
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
    ORDER BY d.cup, d.division, d.type, d.level)
  FROM level_default_scale l JOIN division d ON d.id = l.division_id WHERE l.user_id = $1`);

const GAMES_SQL = list(`SELECT json_agg(json_build_object(
    'id', g.id, 'startsAt', g.starts_at, 'division', ${DIVISION_JSON}, 'cupRound', g.cup_round,
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

const PREPARATIONS_SQL = list(`SELECT json_agg(json_build_object(
    'id', p.id, 'gameId', p.game_id, 'teamCount', p.team_count,
    'team1', json_build_object('rank', p.team1_rank,
      'wins', p.team1_wins, 'losses', p.team1_losses, 'players', p.team1_players,
      'coaches', p.team1_coaches, 'alreadyRefereed', p.team1_already_refereed),
    'team2', json_build_object('rank', p.team2_rank,
      'wins', p.team2_wins, 'losses', p.team2_losses, 'players', p.team2_players,
      'coaches', p.team2_coaches, 'alreadyRefereed', p.team2_already_refereed),
    'crew', json_build_object('placement', p.crew_placement,
      'communication', p.crew_communication, 'management', p.crew_management,
      'table', p.crew_table, 'contact', p.crew_contact),
    'observed', p.observed,
    'updatedBy', CASE WHEN p.updated_by IS NULL THEN NULL
      WHEN p.updated_by = $1 THEN 'self' ELSE 'colleague' END,
    'createdAt', p.created_at, 'updatedAt', p.updated_at, 'deletedAt', p.deleted_at)
    ORDER BY p.created_at, p.id)
  FROM game_preparation p WHERE p.user_id = $1`);

// Fiches collègues du compte liées au compte d'un collègue (sans identifiant de ce compte).
const COLLEAGUE_LINKS_SQL = list(`SELECT json_agg(json_build_object(
    'personId', l.person_id, 'createdAt', l.created_at)
    ORDER BY l.created_at, l.person_id)
  FROM colleague_link l WHERE l.owner_user_id = $1`);

// Collègues qui ont lié une de leurs fiches à ce compte : leur prénom et leur nom seulement.
const LINKED_BY_SQL = list(`SELECT json_agg(json_build_object(
    'firstname', u.firstname, 'lastname', u.lastname, 'createdAt', l.created_at)
    ORDER BY l.created_at, u.id)
  FROM colleague_link l JOIN "user" u ON u.id = l.owner_user_id WHERE l.linked_user_id = $1`);

// Liens de partage créés par le compte, sans l'empreinte du jeton.
const SHARE_LINKS_SQL = list(`SELECT json_agg(json_build_object(
    'gameId', sl.game_id, 'personId', sl.person_id, 'createdAt', sl.created_at,
    'expiresAt', sl.expires_at, 'acceptedAt', sl.accepted_at, 'revokedAt', sl.revoked_at)
    ORDER BY sl.created_at, sl.id)
  FROM preparation_share_link sl WHERE sl.owner_user_id = $1`);

// Préparations que le compte partage, match par match.
const SHARES_GIVEN_SQL = list(`SELECT json_agg(json_build_object(
    'gameId', s.game_id, 'personId', s.person_id, 'createdAt', s.created_at)
    ORDER BY s.created_at, s.game_id)
  FROM game_share s WHERE s.owner_user_id = $1`);

// Préparations partagées avec le compte, encore stockées : ses propres cases « déjà
// arbitrée » et le collègue qui partage. `active` reprend la règle d'accès de l'application
// (`VALID_SHARE`) ; la date du match, donnée du collègue, ne sort que tant que le partage est
// actif (pas après la suppression du match, par exemple). Le contenu de la préparation reste
// à ce collègue.
const SHARES_RECEIVED_SQL = list(`SELECT json_agg(json_build_object(
    'sharedBy', json_build_object('firstname', u.firstname, 'lastname', u.lastname),
    'active', v.active,
    'gameStartsAt', CASE WHEN v.active THEN g.starts_at END,
    'team1AlreadyRefereed', s.team1_already_refereed,
    'team2AlreadyRefereed', s.team2_already_refereed,
    'createdAt', s.created_at, 'updatedAt', s.updated_at)
    ORDER BY s.created_at, s.game_id)
  FROM game_share s
  JOIN "user" u ON u.id = s.owner_user_id
  JOIN game g ON g.id = s.game_id AND g.user_id = s.owner_user_id
  LEFT JOIN colleague_link l ON l.owner_user_id = s.owner_user_id AND l.person_id = s.person_id
  CROSS JOIN LATERAL (SELECT coalesce(${VALID_SHARE}, false) AS active) v
  WHERE s.recipient_user_id = $1`);

// Un objet par axe enregistré (axe par défaut, éventuellement supprimé, ou catégorie
// personnelle), dans l'ordre choisi.
const IMPROVEMENT_AXES_SQL = list(`SELECT json_agg(json_build_object(
    'id', i.id, 'defaultKey', i.default_key, 'label', i.label, 'hidden', i.hidden,
    'position', i.position, 'body', i.body,
    'createdAt', i.created_at, 'updatedAt', i.updated_at)
    ORDER BY i.position)
  FROM improvement_axis i WHERE i.user_id = $1`);

// La ligne de barème est jointe sans filtre de propriétaire : elle peut appartenir au barème
// commun. L'indemnité, elle, est filtrée par propriétaire.
const COMPENSATIONS_SQL = list(`SELECT json_agg(json_build_object(
    'id', c.id, 'gameId', c.game_id, 'startsAt', c.starts_at, 'division', ${DIVISION_JSON},
    'cupRound', c.cup_round, 'team1Id', c.team1_id, 'team2Id', c.team2_id, 'addressId', c.address_id,
    'distanceMeters', c.distance_m, 'travelShared', c.travel_shared, 'payer', c.payer,
    'gameCount', c.game_count, 'plateauGameCents', c.plateau_game_cents,
    'paidOn', c.paid_on,
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
  'preparations', ${PREPARATIONS_SQL},
  'colleagueLinks', ${COLLEAGUE_LINKS_SQL},
  'linkedBy', ${LINKED_BY_SQL},
  'shareLinks', ${SHARE_LINKS_SQL},
  'sharesGiven', ${SHARES_GIVEN_SQL},
  'sharesReceived', ${SHARES_RECEIVED_SQL},
  'improvementAxes', ${IMPROVEMENT_AXES_SQL},
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
  preparations: jsonList,
  colleagueLinks: jsonList,
  linkedBy: jsonList,
  shareLinks: jsonList,
  sharesGiven: jsonList,
  sharesReceived: jsonList,
  improvementAxes: jsonList,
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
