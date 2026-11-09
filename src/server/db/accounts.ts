/**
 * Requêtes SQL de la page admin « Comptes » (bloc 10). Réservées aux administrateurs :
 * chaque appelant vérifie `requireAdmin` avant. Aucune ne renvoie de hash ni de jeton.
 */
import { z } from "zod";
import { ACTIVE_ACCOUNT_CONDITION } from "./account-state";
import type { AccountStateColumns } from "./account-state";
import { EmailAlreadyUsedError, userRoleSchema } from "./users";
import type { Queryable, UserRole } from "./users";

export type AccountSummary = {
  id: string;
  email: string;
  role: UserRole;
  firstname: string | null;
  lastname: string | null;
  createdAt: Date;
  /** Dernière activité connue (session la plus récemment vue), ou `null`. */
  lastSeenAt: Date | null;
  state: AccountStateColumns;
};

/** Ce qu'efface la suppression du compte (données actives seulement). */
export type AccountContents = {
  compensations: number;
  games: number;
  notes: number;
  scales: number;
  colleagues: number;
};

export type AccountDetail = AccountSummary & { contents: AccountContents };

const SUMMARY_COLUMNS = `u.id, u.email, u.role, u.firstname, u.lastname, u.created_at,
  u.blocked_at, u.blocked_until, u.deletion_due_at,
  (SELECT max(s.last_seen_at) FROM session s WHERE s.user_id = u.id) AS last_seen_at`;

const summaryRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: userRoleSchema,
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  created_at: z.date(),
  last_seen_at: z.date().nullable(),
  blocked_at: z.date().nullable(),
  blocked_until: z.date().nullable(),
  deletion_due_at: z.date().nullable(),
});

const detailRowSchema = summaryRowSchema.extend({
  compensations: z.number().int(),
  games: z.number().int(),
  notes: z.number().int(),
  scales: z.number().int(),
  colleagues: z.number().int(),
});

function toSummary(row: z.infer<typeof summaryRowSchema>): AccountSummary {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    firstname: row.firstname,
    lastname: row.lastname,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    state: {
      blockedAt: row.blocked_at,
      blockedUntil: row.blocked_until,
      deletionDueAt: row.deletion_due_at,
    },
  };
}

// Tri par nom puis prénom ; un compte sans nom (créé avant le bloc 10) se range par email.
const LIST_ACCOUNTS_SQL = `SELECT ${SUMMARY_COLUMNS}
FROM "user" u
ORDER BY lower(coalesce(u.lastname, u.email)), lower(coalesce(u.firstname, '')), lower(u.email)`;

const FIND_ACCOUNT_SQL = `SELECT ${SUMMARY_COLUMNS},
  (SELECT count(*) FROM compensation c WHERE c.user_id = u.id AND c.deleted_at IS NULL)::integer
    AS compensations,
  (SELECT count(*) FROM game g WHERE g.user_id = u.id AND g.deleted_at IS NULL)::integer AS games,
  (SELECT count(*) FROM note n WHERE n.user_id = u.id AND n.deleted_at IS NULL)::integer AS notes,
  (SELECT count(*) FROM scale sc WHERE sc.user_id = u.id AND sc.deleted_at IS NULL)::integer
    AS scales,
  (SELECT count(*) FROM person p WHERE p.user_id = u.id AND NOT p.is_self)::integer AS colleagues
FROM "user" u
WHERE u.id = $1`;

// Verrou de ligne : deux admins qui agissent en même temps sur le même compte s'attendent.
const LOCK_ACCOUNT_SQL = `SELECT ${SUMMARY_COLUMNS}
FROM "user" u
WHERE u.id = $1
FOR UPDATE OF u`;

// Verrouille les autres admins actifs (ordre fixe) : deux admins ne peuvent pas se retirer
// mutuellement leurs droits en même temps et laisser l'application sans administrateur.
const LOCK_OTHER_ACTIVE_ADMINS_SQL = `SELECT u.id
FROM "user" u
WHERE u.role = 'admin' AND u.id <> $1 AND ${ACTIVE_ACCOUNT_CONDITION}
ORDER BY u.id
FOR UPDATE OF u`;

const UPDATE_ACCOUNT_SQL = `UPDATE "user"
SET firstname = $2, lastname = $3, email = $4, role = $5
WHERE id = $1
RETURNING id`;

const BLOCK_ACCOUNT_SQL = `UPDATE "user"
SET blocked_at = now(), blocked_until = $2
WHERE id = $1
RETURNING blocked_until`;

const UNBLOCK_ACCOUNT_SQL = `UPDATE "user"
SET blocked_at = NULL, blocked_until = NULL
WHERE id = $1
RETURNING id`;

const SCHEDULE_DELETION_SQL = `UPDATE "user"
SET deletion_due_at = now() + $2::integer * interval '1 day'
WHERE id = $1 AND deletion_due_at IS NULL
RETURNING deletion_due_at`;

const CANCEL_DELETION_SQL = `UPDATE "user"
SET deletion_due_at = NULL
WHERE id = $1 AND deletion_due_at IS NOT NULL
RETURNING id`;

// Suppression physique : CASCADE depuis "user" (indemnités, matchs, notes, barèmes,
// collègues, sessions…) ; le journal de sécurité garde ses lignes, anonymisées (SET NULL).
const PURGE_DUE_ACCOUNTS_SQL = `DELETE FROM "user"
WHERE deletion_due_at IS NOT NULL AND deletion_due_at <= now()
RETURNING id`;

const PG_UNIQUE_VIOLATION = "23505";

const idRowSchema = z.object({ id: z.uuid() });

/** Tous les comptes, par nom. */
export async function listAccounts(db: Queryable): Promise<AccountSummary[]> {
  const result = await db.query(LIST_ACCOUNTS_SQL, []);
  return result.rows.map((raw) => toSummary(summaryRowSchema.parse(raw)));
}

/** Un compte et le compte de ses données ; `null` s'il n'existe pas. */
export async function findAccount(db: Queryable, accountId: string): Promise<AccountDetail | null> {
  const result = await db.query(FIND_ACCOUNT_SQL, [accountId]);
  const raw = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = detailRowSchema.parse(raw);
  return {
    ...toSummary(row),
    contents: {
      compensations: row.compensations,
      games: row.games,
      notes: row.notes,
      scales: row.scales,
      colleagues: row.colleagues,
    },
  };
}

/** Verrouille un compte pour la transaction ; `null` s'il n'existe pas. */
export async function lockAccount(
  db: Queryable,
  accountId: string,
): Promise<AccountSummary | null> {
  const result = await db.query(LOCK_ACCOUNT_SQL, [accountId]);
  const raw = result.rows[0];
  return raw === undefined ? null : toSummary(summaryRowSchema.parse(raw));
}

/** Nombre d'admins actifs autres que `accountId`, verrouillés jusqu'à la fin de la transaction. */
export async function lockOtherActiveAdmins(db: Queryable, accountId: string): Promise<number> {
  const result = await db.query(LOCK_OTHER_ACTIVE_ADMINS_SQL, [accountId]);
  return result.rows.length;
}

/** Modifie nom, prénom, email et rôle. Lève `EmailAlreadyUsedError` si l'email est pris. */
export async function updateAccount(
  db: Queryable,
  input: {
    accountId: string;
    firstname: string;
    lastname: string;
    email: string;
    role: UserRole;
  },
): Promise<boolean> {
  try {
    const result = await db.query(UPDATE_ACCOUNT_SQL, [
      input.accountId,
      input.firstname,
      input.lastname,
      input.email,
      input.role,
    ]);
    return result.rows.length > 0;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === PG_UNIQUE_VIOLATION) {
      throw new EmailAlreadyUsedError();
    }
    throw error;
  }
}

/** Bloque un compte jusqu'à `until` (exclu), ou sans fin avec `null`. */
export async function blockAccount(
  db: Queryable,
  input: { accountId: string; until: Date | null },
): Promise<boolean> {
  const result = await db.query(BLOCK_ACCOUNT_SQL, [input.accountId, input.until]);
  return result.rows.length > 0;
}

export async function unblockAccount(db: Queryable, accountId: string): Promise<boolean> {
  const result = await db.query(UNBLOCK_ACCOUNT_SQL, [accountId]);
  return result.rows.length > 0;
}

/** Programme la suppression dans `days` jours ; `null` si elle l'était déjà ou si le compte n'existe pas. */
export async function scheduleAccountDeletion(
  db: Queryable,
  input: { accountId: string; days: number },
): Promise<Date | null> {
  const result = await db.query(SCHEDULE_DELETION_SQL, [input.accountId, input.days]);
  const raw = result.rows[0];
  return raw === undefined
    ? null
    : z.object({ deletion_due_at: z.date() }).parse(raw).deletion_due_at;
}

export async function cancelAccountDeletion(db: Queryable, accountId: string): Promise<boolean> {
  const result = await db.query(CANCEL_DELETION_SQL, [accountId]);
  return result.rows.length > 0;
}

/** Efface définitivement les comptes dont la suppression est due. Renvoie leurs identifiants. */
export async function purgeDueAccounts(db: Queryable): Promise<string[]> {
  const result = await db.query(PURGE_DUE_ACCOUNTS_SQL, []);
  return result.rows.map((raw) => idRowSchema.parse(raw).id);
}
