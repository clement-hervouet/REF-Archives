/**
 * Requêtes SQL de la préparation partagée (migration 035) : partages d'un match, vue et
 * écriture du destinataire, candidats au partage vus par le propriétaire.
 *
 * Toute lecture ou écriture pour un destinataire passe par `VALID_SHARE`
 * (`share-access.ts`) avec `s.recipient_user_id` = compte de la session : jamais par les
 * requêtes du propriétaire (`preparations.ts`, `games.ts`) appelées avec un autre compte.
 * Les jointures vers les équipes, clubs et adresse du match reprennent le propriétaire
 * (`g.user_id`), comme partout ailleurs.
 */
import { z } from "zod";
import type { GameNotesFilters } from "@/lib/schemas/game-notes-filters";
import {
  MATCH_ADDRESS_COLUMNS,
  MATCH_CLUBS_COLUMNS,
  matchAddressFields,
  matchClubsFields,
  matchPartiesColumns,
  matchPartiesFields,
  matchTeamJoins,
  toMatchAddress,
  toMatchClubs,
  toMatchParties,
} from "./match-info";
import type { MatchAddress, MatchClubs, MatchDivision } from "./match-info";
import { PREPARATION_COLUMNS, toPreparation } from "./preparations";
import type { Preparation, PreparationListItem, PreparationsPage } from "./preparations";
import type { PreparationForm } from "@/lib/schemas/preparations";
import { SHARE_FROM, VALID_SHARE, notBeingDeleted } from "./share-access";
import type { Queryable } from "./users";

/** Cases « déjà arbitrée » d'un arbitre du partage. */
export type RefereedChecks = { team1: boolean; team2: boolean };

const checksFields = {
  team1_already_refereed: z.boolean(),
  team2_already_refereed: z.boolean(),
};

function toChecks(row: { team1_already_refereed: boolean; team2_already_refereed: boolean }) {
  return { team1: row.team1_already_refereed, team2: row.team2_already_refereed };
}

// ─── Destinataire : accès et écriture ───────────────────────────────────────

const recipientShareRowSchema = z.object({
  starts_at: z.date(),
  owner_user_id: z.uuid(),
  person_id: z.uuid(),
  ...checksFields,
});

/** Partage valide d'un match pour le destinataire connecté. */
export type RecipientShare = {
  /** Date du match : sert à calculer « déjà arbitrée » du propriétaire. */
  startsAt: Date;
  ownerUserId: string;
  /** Fiche du destinataire chez le propriétaire. */
  personId: string;
  /** Cases « déjà arbitrée » du destinataire. */
  checks: RefereedChecks;
};

// Verrouille le match (comme le propriétaire, `lockGameForPreparation`) : un enregistrement
// du propriétaire et un du destinataire passent l'un après l'autre.
const LOCK_RECIPIENT_SHARE_SQL = `SELECT g.starts_at, s.owner_user_id, s.person_id,
  s.team1_already_refereed, s.team2_already_refereed
FROM ${SHARE_FROM}
WHERE ${VALID_SHARE} AND s.game_id = $1 AND s.recipient_user_id = $2
FOR UPDATE OF g, s`;

/**
 * Verrouille un match partagé avec `viewerId` jusqu'à la fin de la transaction. `null` si
 * aucun partage valide : même réponse qu'un match inexistant.
 */
export async function lockRecipientShare(
  db: Queryable,
  input: { gameId: string; viewerId: string },
): Promise<RecipientShare | null> {
  const result = await db.query(LOCK_RECIPIENT_SHARE_SQL, [input.gameId, input.viewerId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = recipientShareRowSchema.parse(raw);
  return {
    startsAt: row.starts_at,
    ownerUserId: row.owner_user_id,
    personId: row.person_id,
    checks: toChecks(row),
  };
}

const FIND_RECIPIENT_PREPARATION_SQL = `SELECT ${PREPARATION_COLUMNS}
FROM ${SHARE_FROM}
JOIN game_preparation p ON p.game_id = g.id AND p.user_id = g.user_id AND p.deleted_at IS NULL
WHERE ${VALID_SHARE} AND s.game_id = $1 AND s.recipient_user_id = $2`;

/** Préparation active d'un match partagé avec `viewerId` ; `null` sans partage ou sans préparation. */
export async function findRecipientPreparation(
  db: Queryable,
  input: { gameId: string; viewerId: string },
): Promise<Preparation | null> {
  const result = await db.query(FIND_RECIPIENT_PREPARATION_SQL, [input.gameId, input.viewerId]);
  const raw = result.rows[0];
  return raw === undefined ? null : toPreparation(raw);
}

// Seules les colonnes communes sont modifiées. Les cases du propriétaire ne sont écrites
// qu'à la création de la préparation (`ownerChecks`, son calcul « déjà arbitrée »), jamais
// ensuite. Le propriétaire reste `user_id`.
const UPSERT_COMMON_SQL = `INSERT INTO game_preparation (user_id, game_id, team_count,
  team1_rank, team1_wins, team1_losses, team1_players, team1_coaches,
  team2_rank, team2_wins, team2_losses, team2_players, team2_coaches,
  crew_placement, crew_communication, crew_management, crew_table, crew_contact, observed,
  team1_already_refereed, team2_already_refereed, updated_by)
SELECT s.owner_user_id, s.game_id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
  $16, $17, $18, $19, $20, $21, $2
FROM ${SHARE_FROM}
WHERE ${VALID_SHARE} AND s.game_id = $1 AND s.recipient_user_id = $2
ON CONFLICT (game_id) WHERE deleted_at IS NULL
DO UPDATE SET
  team_count = EXCLUDED.team_count,
  team1_rank = EXCLUDED.team1_rank, team1_wins = EXCLUDED.team1_wins, team1_losses = EXCLUDED.team1_losses,
  team1_players = EXCLUDED.team1_players, team1_coaches = EXCLUDED.team1_coaches,
  team2_rank = EXCLUDED.team2_rank, team2_wins = EXCLUDED.team2_wins, team2_losses = EXCLUDED.team2_losses,
  team2_players = EXCLUDED.team2_players, team2_coaches = EXCLUDED.team2_coaches,
  crew_placement = EXCLUDED.crew_placement, crew_communication = EXCLUDED.crew_communication,
  crew_management = EXCLUDED.crew_management, crew_table = EXCLUDED.crew_table,
  crew_contact = EXCLUDED.crew_contact, observed = EXCLUDED.observed,
  updated_by = EXCLUDED.updated_by
RETURNING id`;

/**
 * Écrit les champs communs de la préparation d'un match partagé avec `viewerId` (auteur :
 * `viewerId`). Le partage doit avoir été verrouillé dans la même transaction. Faux si le
 * partage n'est plus valide.
 */
export async function saveRecipientPreparation(
  db: Queryable,
  /**
   * Les cases « déjà arbitrée » de `preparation` sont ignorées. `ownerChecks` : cases du
   * propriétaire si la préparation est créée ici (ignorées si elle existe déjà).
   */
  input: {
    gameId: string;
    viewerId: string;
    preparation: PreparationForm;
    ownerChecks: RefereedChecks;
  },
): Promise<boolean> {
  const { teamCount, team1, team2, crew, observed } = input.preparation;
  const team = (values: PreparationForm["team1"]) => [
    values.rank,
    values.wins,
    values.losses,
    values.players,
    values.coaches,
  ];
  const result = await db.query(UPSERT_COMMON_SQL, [
    input.gameId,
    input.viewerId,
    teamCount,
    ...team(team1),
    ...team(team2),
    crew.placement,
    crew.communication,
    crew.management,
    crew.table,
    crew.contact,
    observed,
    input.ownerChecks.team1,
    input.ownerChecks.team2,
  ]);
  return result.rows.length > 0;
}

/** Écrit les cases « déjà arbitrée » du destinataire sur son partage. */
export async function saveRecipientChecks(
  db: Queryable,
  input: { gameId: string; viewerId: string; checks: RefereedChecks },
): Promise<void> {
  await db.query(
    `UPDATE game_share SET team1_already_refereed = $3, team2_already_refereed = $4
WHERE game_id = $1 AND recipient_user_id = $2`,
    [input.gameId, input.viewerId, input.checks.team1, input.checks.team2],
  );
}

/** Le destinataire quitte le partage d'un match. Faux s'il n'y en avait pas. */
export async function leaveShare(
  db: Queryable,
  input: { gameId: string; viewerId: string },
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM game_share WHERE game_id = $1 AND recipient_user_id = $2 RETURNING game_id`,
    [input.gameId, input.viewerId],
  );
  return result.rows.length > 0;
}

// ─── Destinataire : en-tête du match ────────────────────────────────────────

const FIND_RECIPIENT_GAME_SQL = `SELECT g.id, g.starts_at, ${matchPartiesColumns("g")},
  ${MATCH_CLUBS_COLUMNS},
  ${MATCH_ADDRESS_COLUMNS},
  s.owner_user_id, s.team1_already_refereed, s.team2_already_refereed,
  owner.firstname AS owner_firstname, owner.lastname AS owner_lastname,
  g.observer_id IS NOT NULL AS has_observer
FROM ${SHARE_FROM}
JOIN "user" owner ON owner.id = s.owner_user_id
JOIN division d ON d.id = g.division_id
${matchTeamJoins("g")}
JOIN address a ON a.id = g.address_id AND a.user_id = g.user_id
WHERE ${VALID_SHARE} AND s.game_id = $1 AND s.recipient_user_id = $2`;

const recipientGameRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  ...matchPartiesFields,
  ...matchClubsFields,
  ...matchAddressFields,
  owner_user_id: z.uuid(),
  ...checksFields,
  owner_firstname: z.string().nullable(),
  owner_lastname: z.string().nullable(),
  has_observer: z.boolean(),
});

/**
 * Match partagé tel que le voit le destinataire : en lecture seule. Les clubs sont ceux du
 * propriétaire ; leurs logos restent lisibles par le destinataire tant que le partage vaut.
 */
export type RecipientGame = MatchClubs & {
  id: string;
  startsAt: Date;
  division: MatchDivision;
  team1Name: string;
  team2Name: string | null;
  address: MatchAddress;
  owner: { userId: string; firstname: string | null; lastname: string | null };
  /** Cases « déjà arbitrée » du destinataire. */
  checks: RefereedChecks;
  /** Un observateur est saisi : « Observé » pré-cochée, comme chez le propriétaire. */
  hasObserver: boolean;
};

/** Match partagé avec `viewerId` (en-tête de la préparation) ; `null` sans partage valide. */
export async function findRecipientGame(
  db: Queryable,
  input: { gameId: string; viewerId: string },
): Promise<RecipientGame | null> {
  const result = await db.query(FIND_RECIPIENT_GAME_SQL, [input.gameId, input.viewerId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = recipientGameRowSchema.parse(raw);
  return {
    id: row.id,
    startsAt: row.starts_at,
    ...toMatchParties(row),
    ...toMatchClubs(row),
    address: toMatchAddress(row),
    owner: {
      userId: row.owner_user_id,
      firstname: row.owner_firstname,
      lastname: row.owner_lastname,
    },
    checks: toChecks(row),
    hasObserver: row.has_observer,
  };
}

// ─── Arbitres du partage (propriétaire et destinataires) ────────────────────

const LIST_RECIPIENTS_SQL = `SELECT s.person_id, s.recipient_user_id, u.firstname, u.lastname,
  s.team1_already_refereed, s.team2_already_refereed
FROM ${SHARE_FROM}
JOIN "user" u ON u.id = s.recipient_user_id
WHERE ${VALID_SHARE} AND s.game_id = $1 AND s.owner_user_id = $2
ORDER BY s.created_at, s.person_id`;

const recipientRowSchema = z.object({
  person_id: z.uuid(),
  recipient_user_id: z.uuid(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  ...checksFields,
});

/** Destinataire d'un partage valide, avec le prénom et le nom de son compte. */
export type ShareRecipient = {
  personId: string;
  userId: string;
  firstname: string | null;
  lastname: string | null;
  checks: RefereedChecks;
};

/**
 * Destinataires des partages valides d'un match de `ownerUserId`. À n'appeler qu'après
 * avoir vérifié que la session est le propriétaire ou un destinataire du match.
 */
export async function listShareRecipients(
  db: Queryable,
  input: { gameId: string; ownerUserId: string },
): Promise<ShareRecipient[]> {
  const result = await db.query(LIST_RECIPIENTS_SQL, [input.gameId, input.ownerUserId]);
  return result.rows.map((raw) => {
    const row = recipientRowSchema.parse(raw);
    return {
      personId: row.person_id,
      userId: row.recipient_user_id,
      firstname: row.firstname,
      lastname: row.lastname,
      checks: toChecks(row),
    };
  });
}

// ─── Propriétaire : partager ────────────────────────────────────────────────

const shareTargetRowSchema = z.object({ linked_user_id: z.uuid().nullable() });

// Le match doit être actif, au propriétaire, hors plateau, et la fiche un collègue arbitre
// du match ; le propriétaire ne doit pas avoir de suppression programmée (un lien qu'il a
// envoyé avant ne s'accepte plus). Renvoie le compte lié à la fiche (NULL si aucun).
const FIND_SHARE_TARGET_SQL = `SELECT l.linked_user_id
FROM game g
JOIN person p ON p.id = $3 AND p.user_id = g.user_id AND NOT p.is_self
LEFT JOIN colleague_link l ON l.owner_user_id = g.user_id AND l.person_id = p.id
WHERE g.id = $1 AND g.user_id = $2 AND g.deleted_at IS NULL AND g.team2_id IS NOT NULL
  AND p.id IN (g.referee1_id, g.referee2_id, g.referee3_id)
  AND ${notBeingDeleted("g.user_id")}
FOR UPDATE OF g`;

/**
 * Verrouille un match du propriétaire pour partager sa préparation avec un arbitre :
 * `null` si le match ou la fiche ne s'y prête pas, sinon le compte lié à la fiche
 * (`linkedUserId` `null` si la fiche n'est liée à aucun compte).
 */
export async function lockShareTarget(
  db: Queryable,
  input: { gameId: string; ownerUserId: string; personId: string },
): Promise<{ linkedUserId: string | null } | null> {
  const result = await db.query(FIND_SHARE_TARGET_SQL, [
    input.gameId,
    input.ownerUserId,
    input.personId,
  ]);
  const raw = result.rows[0];
  return raw === undefined
    ? null
    : { linkedUserId: shareTargetRowSchema.parse(raw).linked_user_id };
}

/** Partage la préparation d'un match (vérifié par `lockShareTarget`) avec un compte lié. */
export async function insertShare(
  db: Queryable,
  input: { ownerUserId: string; gameId: string; personId: string; recipientUserId: string },
): Promise<void> {
  await db.query(
    `INSERT INTO game_share (owner_user_id, game_id, person_id, recipient_user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (game_id, person_id) DO UPDATE SET recipient_user_id = EXCLUDED.recipient_user_id`,
    [input.ownerUserId, input.gameId, input.personId, input.recipientUserId],
  );
}

/** Le propriétaire arrête de partager un match avec un arbitre. Faux s'il n'y avait pas de partage. */
export async function deleteShare(
  db: Queryable,
  input: { ownerUserId: string; gameId: string; personId: string },
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM game_share WHERE game_id = $1 AND owner_user_id = $2 AND person_id = $3
RETURNING game_id`,
    [input.gameId, input.ownerUserId, input.personId],
  );
  return result.rows.length > 0;
}

// Après un changement d'officiels : un arbitre retiré du match perd son partage et son
// lien en attente.
const DELETE_STALE_SHARES_SQL = `WITH target AS (
  SELECT id, user_id, referee1_id, referee2_id, referee3_id FROM game
  WHERE id = $1 AND user_id = $2
),
links AS (
  UPDATE preparation_share_link sl SET revoked_at = now()
  FROM target t
  WHERE sl.game_id = t.id AND sl.owner_user_id = t.user_id
    AND sl.accepted_at IS NULL AND sl.revoked_at IS NULL
    AND sl.person_id NOT IN (
      SELECT unnest(array_remove(ARRAY[t.referee1_id, t.referee2_id, t.referee3_id], NULL))
    )
)
DELETE FROM game_share s USING target t
WHERE s.game_id = t.id AND s.owner_user_id = t.user_id
  AND s.person_id NOT IN (
    SELECT unnest(array_remove(ARRAY[t.referee1_id, t.referee2_id, t.referee3_id], NULL))
  )`;

/** Retire les partages et liens en attente des fiches qui ne sont plus arbitres du match. */
export async function deleteStaleShares(
  db: Queryable,
  input: { gameId: string; ownerUserId: string },
): Promise<void> {
  await db.query(DELETE_STALE_SHARES_SQL, [input.gameId, input.ownerUserId]);
}

// ─── Propriétaire : arbitres à qui partager ─────────────────────────────────

// Arbitres collègues du match (pas la fiche « moi ») : compte lié, partage valide, lien en
// attente. La validité du partage reprend `VALID_SHARE`.
const LIST_CANDIDATES_SQL = `SELECT p.id, p.firstname, p.lastname, p.has_account,
  u.id AS linked_user_id, u.firstname AS linked_firstname, u.lastname AS linked_lastname,
  EXISTS (
    SELECT 1 FROM game_share s, colleague_link l
    WHERE ${VALID_SHARE} AND s.person_id = p.id
  ) AS shared,
  (SELECT max(sl.expires_at) FROM preparation_share_link sl
    WHERE sl.game_id = g.id AND sl.owner_user_id = g.user_id AND sl.person_id = p.id
      AND sl.accepted_at IS NULL AND sl.revoked_at IS NULL AND sl.expires_at > now()
  ) AS pending_until
FROM game g
JOIN person p ON p.user_id = g.user_id AND NOT p.is_self
  AND p.id IN (g.referee1_id, g.referee2_id, g.referee3_id)
LEFT JOIN colleague_link cl ON cl.owner_user_id = g.user_id AND cl.person_id = p.id
LEFT JOIN "user" u ON u.id = cl.linked_user_id
WHERE g.id = $1 AND g.user_id = $2 AND g.deleted_at IS NULL AND g.team2_id IS NOT NULL
ORDER BY CASE p.id WHEN g.referee1_id THEN 1 WHEN g.referee2_id THEN 2 ELSE 3 END`;

const candidateRowSchema = z.object({
  id: z.uuid(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  has_account: z.boolean(),
  linked_user_id: z.uuid().nullable(),
  linked_firstname: z.string().nullable(),
  linked_lastname: z.string().nullable(),
  shared: z.boolean(),
  pending_until: z.date().nullable(),
});

/** Arbitre collègue d'un match, vu depuis le panneau « Partage » du propriétaire. */
export type ShareCandidate = {
  personId: string;
  firstname: string | null;
  lastname: string | null;
  hasAccount: boolean;
  /** Compte lié à la fiche, ou `null`. */
  linked: { userId: string; firstname: string | null; lastname: string | null } | null;
  shared: boolean;
  /** Fin de validité du lien en attente, ou `null`. */
  pendingUntil: Date | null;
};

/** Arbitres collègues d'un match actif du propriétaire (hors plateau), dans l'ordre officiel. */
export async function listShareCandidates(
  db: Queryable,
  input: { gameId: string; ownerUserId: string },
): Promise<ShareCandidate[]> {
  const result = await db.query(LIST_CANDIDATES_SQL, [input.gameId, input.ownerUserId]);
  return result.rows.map((raw) => {
    const row = candidateRowSchema.parse(raw);
    return {
      personId: row.id,
      firstname: row.firstname,
      lastname: row.lastname,
      hasAccount: row.has_account,
      linked:
        row.linked_user_id === null
          ? null
          : {
              userId: row.linked_user_id,
              firstname: row.linked_firstname,
              lastname: row.linked_lastname,
            },
      shared: row.shared,
      pendingUntil: row.pending_until,
    };
  });
}

// ─── Destinataire : liste « Partagées avec moi » ────────────────────────────

/** Préparations par page (comme la liste du propriétaire). */
const SHARED_PAGE_SIZE = 30;

// Matchs partagés avec le destinataire, préparation écrite ou non (il peut la commencer).
// Filtres de niveau seulement : les clubs du propriétaire ne sont pas ceux du destinataire.
const LIST_RECIPIENT_SQL = `SELECT g.id, g.starts_at, ${matchPartiesColumns("g")},
  ${MATCH_CLUBS_COLUMNS},
  owner.firstname AS owner_firstname, owner.lastname AS owner_lastname,
  p.team_count, p.team1_rank, p.team1_wins, p.team1_losses,
  p.team2_rank, p.team2_wins, p.team2_losses, coalesce(p.observed, false) AS observed,
  s.team1_already_refereed, s.team2_already_refereed
FROM ${SHARE_FROM}
JOIN "user" owner ON owner.id = s.owner_user_id
JOIN division d ON d.id = g.division_id
${matchTeamJoins("g")}
LEFT JOIN game_preparation p ON p.game_id = g.id AND p.user_id = g.user_id AND p.deleted_at IS NULL
WHERE ${VALID_SHARE} AND s.recipient_user_id = $1
  AND ($2::text IS NULL OR d.division::text = $2::text)
  AND ($3::text IS NULL OR d.type::text = $3::text)
  AND ($4::text IS NULL OR d.level::text = $4::text)
ORDER BY g.starts_at DESC, g.id
LIMIT $5::integer OFFSET $6::integer`;

const smallint = z.number().int().nullable();

const recipientListRowSchema = z.object({
  id: z.uuid(),
  starts_at: z.date(),
  ...matchPartiesFields,
  ...matchClubsFields,
  owner_firstname: z.string().nullable(),
  owner_lastname: z.string().nullable(),
  team_count: smallint,
  team1_rank: smallint,
  team1_wins: smallint,
  team1_losses: smallint,
  team2_rank: smallint,
  team2_wins: smallint,
  team2_losses: smallint,
  observed: z.boolean(),
  ...checksFields,
});

/** Préparations partagées avec `viewerId`, du match le plus récent au plus ancien. */
export async function listRecipientPreparations(
  db: Queryable,
  input: { viewerId: string; filters: GameNotesFilters },
): Promise<PreparationsPage> {
  const { filters } = input;
  const result = await db.query(LIST_RECIPIENT_SQL, [
    input.viewerId,
    filters.category,
    filters.type,
    filters.level,
    SHARED_PAGE_SIZE + 1,
    (filters.page - 1) * SHARED_PAGE_SIZE,
  ]);
  const rows = result.rows.map((raw) => recipientListRowSchema.parse(raw));
  return {
    hasMore: rows.length > SHARED_PAGE_SIZE,
    items: rows.slice(0, SHARED_PAGE_SIZE).map((row): PreparationListItem => ({
      gameId: row.id,
      startsAt: row.starts_at,
      ...toMatchParties(row),
      ...toMatchClubs(row),
      teamCount: row.team_count,
      team1: {
        rank: row.team1_rank,
        wins: row.team1_wins,
        losses: row.team1_losses,
        alreadyRefereed: row.team1_already_refereed,
      },
      team2: {
        rank: row.team2_rank,
        wins: row.team2_wins,
        losses: row.team2_losses,
        alreadyRefereed: row.team2_already_refereed,
      },
      observed: row.observed,
      shared: true,
      sharedBy: { firstname: row.owner_firstname, lastname: row.owner_lastname },
    })),
  };
}

// ─── Page d'un lien de partage ──────────────────────────────────────────────

// Lien en attente dont le match est encore partageable : actif, hors plateau, et la fiche
// toujours arbitre. Rien d'autre que le propriétaire (prénom, nom) et le match.
const FIND_LINK_PREVIEW_SQL = `SELECT g.starts_at, ${matchPartiesColumns("g")},
  sl.owner_user_id, u.firstname AS owner_firstname, u.lastname AS owner_lastname
FROM preparation_share_link sl
JOIN game g ON g.id = sl.game_id AND g.user_id = sl.owner_user_id
  AND g.deleted_at IS NULL AND g.team2_id IS NOT NULL
  AND sl.person_id IN (g.referee1_id, g.referee2_id, g.referee3_id)
JOIN "user" u ON u.id = sl.owner_user_id
JOIN division d ON d.id = g.division_id
${matchTeamJoins("g")}
WHERE sl.token_hash = $1 AND sl.accepted_at IS NULL AND sl.revoked_at IS NULL
  AND sl.expires_at > now() AND ${notBeingDeleted("sl.owner_user_id")}`;

const linkPreviewRowSchema = z.object({
  starts_at: z.date(),
  ...matchPartiesFields,
  owner_user_id: z.uuid(),
  owner_firstname: z.string().nullable(),
  owner_lastname: z.string().nullable(),
});

/** Ce qu'affiche la page d'un lien de partage avant de l'accepter. */
export type ShareLinkPreview = {
  startsAt: Date;
  division: MatchDivision;
  team1Name: string;
  team2Name: string | null;
  owner: { userId: string; firstname: string | null; lastname: string | null };
};

/** Aperçu d'un lien de partage valide, ou `null` (inconnu, expiré, utilisé, révoqué…). */
export async function findShareLinkPreview(
  db: Queryable,
  tokenHash: Buffer,
): Promise<ShareLinkPreview | null> {
  const result = await db.query(FIND_LINK_PREVIEW_SQL, [tokenHash]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = linkPreviewRowSchema.parse(raw);
  return {
    startsAt: row.starts_at,
    ...toMatchParties(row),
    owner: {
      userId: row.owner_user_id,
      firstname: row.owner_firstname,
      lastname: row.owner_lastname,
    },
  };
}
