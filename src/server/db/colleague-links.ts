/**
 * Requêtes SQL des liens entre comptes (préparation partagée, migration 035) :
 *  * `colleague_link` : une fiche collègue du propriétaire pointe vers le compte de ce
 *    collègue. Créé seulement quand le collègue accepte un lien de partage : aucune
 *    requête ne cherche un compte par nom, email ou licence (§6.5, pas d'oracle).
 *  * `preparation_share_link` : lien à usage unique envoyé à la main. Seule l'empreinte du
 *    jeton est stockée ; elle n'est jamais journalisée.
 *
 * Chaque requête filtre sur le propriétaire (`owner_user_id`) ou sur le compte lié
 * (`linked_user_id`) venu de la session, jamais d'un formulaire.
 */
import { z } from "zod";
import type { Queryable } from "./users";

/** Durée de validité d'un lien de partage. */
export const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Liens de partage en attente par compte (anti-abus). */
const MAX_PENDING_SHARE_LINKS = 20;

// ─── Liens entre comptes ────────────────────────────────────────────────────

const linkTargetRowSchema = z.object({
  person_id: z.uuid().nullable(),
  linked_user_id: z.uuid().nullable(),
});

// Lien existant pour la fiche, et fiche déjà liée à ce compte : sert à refuser une liaison
// qui casserait l'une des deux unicités.
const FIND_LINK_CONFLICTS_SQL = `SELECT
  (SELECT linked_user_id FROM colleague_link WHERE owner_user_id = $1 AND person_id = $2)
    AS linked_user_id,
  (SELECT person_id FROM colleague_link WHERE owner_user_id = $1 AND linked_user_id = $3)
    AS person_id`;

export type LinkCheck =
  /** La fiche est déjà liée à ce compte. */
  | "already_linked"
  /** Rien n'empêche la liaison. */
  | "free"
  /** La fiche est liée à un autre compte, ou ce compte à une autre fiche. */
  | "taken";

/** Peut-on lier la fiche `personId` du propriétaire au compte `linkedUserId` ? */
export async function checkLink(
  db: Queryable,
  input: { ownerUserId: string; personId: string; linkedUserId: string },
): Promise<LinkCheck> {
  const result = await db.query(FIND_LINK_CONFLICTS_SQL, [
    input.ownerUserId,
    input.personId,
    input.linkedUserId,
  ]);
  const row = linkTargetRowSchema.parse(result.rows[0]);
  if (row.linked_user_id === input.linkedUserId && row.person_id === input.personId) {
    return "already_linked";
  }
  return row.linked_user_id === null && row.person_id === null ? "free" : "taken";
}

// La fiche doit être un collègue (pas la fiche « moi ») du propriétaire. La case « a un
// compte » est cochée dans la même requête.
const INSERT_LINK_SQL = `WITH colleague AS (
  UPDATE person SET has_account = true
  WHERE id = $2 AND user_id = $1 AND NOT is_self
  RETURNING id
)
INSERT INTO colleague_link (owner_user_id, person_id, linked_user_id)
SELECT $1, id, $3 FROM colleague
ON CONFLICT DO NOTHING
RETURNING person_id`;

/**
 * Lie une fiche collègue du propriétaire à un compte (après `checkLink`). Faux si la fiche
 * n'est pas un collègue du propriétaire ou si une liaison concurrente a pris la place.
 */
export async function insertLink(
  db: Queryable,
  input: { ownerUserId: string; personId: string; linkedUserId: string },
): Promise<boolean> {
  const result = await db.query(INSERT_LINK_SQL, [
    input.ownerUserId,
    input.personId,
    input.linkedUserId,
  ]);
  return result.rows.length > 0;
}

// Délier efface aussi les partages de cette fiche et révoque ses liens en attente : une
// nouvelle liaison, même au même compte, repart de zéro.
const DELETE_LINK_SQL = `WITH deleted AS (
  DELETE FROM colleague_link
  WHERE owner_user_id = $1 AND ($2::uuid IS NULL OR person_id = $2)
    AND ($3::uuid IS NULL OR linked_user_id = $3)
  RETURNING person_id, linked_user_id
),
shares AS (
  DELETE FROM game_share s USING deleted
  WHERE s.owner_user_id = $1 AND s.person_id = deleted.person_id
),
links AS (
  UPDATE preparation_share_link sl SET revoked_at = now()
  FROM deleted
  WHERE sl.owner_user_id = $1 AND sl.person_id = deleted.person_id
    AND sl.accepted_at IS NULL AND sl.revoked_at IS NULL
)
SELECT person_id, linked_user_id FROM deleted`;

const deletedLinkRowSchema = z.object({ person_id: z.uuid(), linked_user_id: z.uuid() });

/**
 * Supprime le lien d'une fiche du propriétaire (`personId`) ou vers un compte
 * (`linkedUserId`, quand c'est le collègue qui se délie), avec ses partages. Renvoie le
 * compte qui était lié, ou `null` s'il n'y avait pas de lien.
 */
export async function deleteLink(
  db: Queryable,
  input: { ownerUserId: string } & (
    { personId: string; linkedUserId?: undefined } | { linkedUserId: string; personId?: undefined }
  ),
): Promise<string | null> {
  const result = await db.query(DELETE_LINK_SQL, [
    input.ownerUserId,
    input.personId ?? null,
    input.linkedUserId ?? null,
  ]);
  const raw = result.rows[0];
  return raw === undefined ? null : deletedLinkRowSchema.parse(raw).linked_user_id;
}

const accountRowSchema = z.object({
  user_id: z.uuid(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
});

/** Compte vu par un collègue lié : prénom et nom de son profil (jamais l'email). */
export type LinkedAccount = { userId: string; firstname: string | null; lastname: string | null };

function toLinkedAccount(row: z.infer<typeof accountRowSchema>): LinkedAccount {
  return { userId: row.user_id, firstname: row.firstname, lastname: row.lastname };
}

const LIST_LINKED_OWNERS_SQL = `SELECT u.id AS user_id, u.firstname, u.lastname
FROM colleague_link l
JOIN "user" u ON u.id = l.owner_user_id
WHERE l.linked_user_id = $1
ORDER BY lower(coalesce(u.lastname, '')), lower(coalesce(u.firstname, '')), u.id`;

/** Comptes qui ont lié une de leurs fiches collègue au compte `userId`. */
export async function listLinkedOwners(db: Queryable, userId: string): Promise<LinkedAccount[]> {
  const result = await db.query(LIST_LINKED_OWNERS_SQL, [userId]);
  return result.rows.map((raw) => toLinkedAccount(accountRowSchema.parse(raw)));
}

const LIST_OWNER_LINKS_SQL = `SELECT l.person_id, u.id AS user_id, u.firstname, u.lastname
FROM colleague_link l
JOIN "user" u ON u.id = l.linked_user_id
WHERE l.owner_user_id = $1`;

/** Comptes liés aux fiches collègues du propriétaire, par fiche. */
export async function listOwnerLinks(
  db: Queryable,
  ownerUserId: string,
): Promise<Map<string, LinkedAccount>> {
  const result = await db.query(LIST_OWNER_LINKS_SQL, [ownerUserId]);
  const links = new Map<string, LinkedAccount>();
  for (const raw of result.rows) {
    const row = accountRowSchema.extend({ person_id: z.uuid() }).parse(raw);
    links.set(row.person_id, toLinkedAccount(row));
  }
  return links;
}

// ─── Liens de partage ───────────────────────────────────────────────────────

// Révoque le lien en attente du même match et du même arbitre, puis crée le nouveau, si
// le propriétaire n'a pas atteint la limite de liens en attente. id NULL = limite atteinte.
const REVOKE_PENDING_SQL = `UPDATE preparation_share_link SET revoked_at = now()
WHERE owner_user_id = $1 AND game_id = $2 AND person_id = $3
  AND accepted_at IS NULL AND revoked_at IS NULL`;

const INSERT_SHARE_LINK_SQL = `WITH allowed AS (
  SELECT (
    SELECT count(*) FROM preparation_share_link
    WHERE owner_user_id = $1::uuid AND accepted_at IS NULL AND revoked_at IS NULL
      AND expires_at > now()
  ) < $6::integer AS ok
),
inserted AS (
  INSERT INTO preparation_share_link (owner_user_id, game_id, person_id, token_hash, expires_at)
  SELECT $1::uuid, $2::uuid, $3::uuid, $4::bytea, $5::timestamptz FROM allowed WHERE ok
  RETURNING id
)
SELECT (SELECT id FROM inserted) AS id`;

const nullableIdRowSchema = z.object({ id: z.uuid().nullable() });

/**
 * Crée un lien de partage (le précédent lien en attente pour ce match et cet arbitre est
 * révoqué). Faux si le propriétaire a atteint la limite de liens en attente. Le match et
 * la fiche doivent avoir été vérifiés avant.
 */
export async function createShareLink(
  db: Queryable,
  input: {
    ownerUserId: string;
    gameId: string;
    personId: string;
    tokenHash: Buffer;
    expiresAt: Date;
  },
): Promise<boolean> {
  await db.query(REVOKE_PENDING_SQL, [input.ownerUserId, input.gameId, input.personId]);
  const result = await db.query(INSERT_SHARE_LINK_SQL, [
    input.ownerUserId,
    input.gameId,
    input.personId,
    input.tokenHash,
    input.expiresAt,
    MAX_PENDING_SHARE_LINKS,
  ]);
  return nullableIdRowSchema.parse(result.rows[0]).id !== null;
}

/** Révoque le lien en attente d'un match et d'un arbitre. Faux s'il n'y en avait pas. */
export async function revokeShareLink(
  db: Queryable,
  input: { ownerUserId: string; gameId: string; personId: string },
): Promise<boolean> {
  const result = await db.query(`${REVOKE_PENDING_SQL} RETURNING id`, [
    input.ownerUserId,
    input.gameId,
    input.personId,
  ]);
  return result.rows.length > 0;
}

const pendingLinkRowSchema = z.object({
  id: z.uuid(),
  owner_user_id: z.uuid(),
  game_id: z.uuid(),
  person_id: z.uuid(),
});

export type PendingShareLink = {
  id: string;
  ownerUserId: string;
  gameId: string;
  personId: string;
};

const PENDING_LINK_SQL = `SELECT id, owner_user_id, game_id, person_id
FROM preparation_share_link
WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;

function toPendingLink(raw: unknown): PendingShareLink {
  const row = pendingLinkRowSchema.parse(raw);
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    gameId: row.game_id,
    personId: row.person_id,
  };
}

/**
 * Lien de partage valide (en attente, non expiré) pour une empreinte de jeton, verrouillé
 * jusqu'à la fin de la transaction ; `null` sinon.
 */
export async function lockPendingShareLink(
  db: Queryable,
  tokenHash: Buffer,
): Promise<PendingShareLink | null> {
  const result = await db.query(`${PENDING_LINK_SQL} FOR UPDATE`, [tokenHash]);
  const raw = result.rows[0];
  return raw === undefined ? null : toPendingLink(raw);
}

/** Marque un lien de partage verrouillé comme accepté par `userId`. */
export async function markShareLinkAccepted(
  db: Queryable,
  input: { linkId: string; userId: string },
): Promise<void> {
  await db.query(
    `UPDATE preparation_share_link SET accepted_at = now(), accepted_by = $2 WHERE id = $1`,
    [input.linkId, input.userId],
  );
}

const nameRowSchema = z.object({
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
});

/** Prénom et nom du profil d'un compte, ou `null` s'il n'existe pas. */
export async function findAccountName(
  db: Queryable,
  userId: string,
): Promise<{ firstname: string | null; lastname: string | null } | null> {
  const result = await db.query(`SELECT firstname, lastname FROM "user" WHERE id = $1`, [userId]);
  const raw = result.rows[0];
  return raw === undefined ? null : nameRowSchema.parse(raw);
}
