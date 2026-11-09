/**
 * Requêtes SQL sur la table `"user"` (§3.2 : SQL à la main, toujours paramétré).
 */
import type { AccountStateColumns } from "./account-state";
import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Forme minimale d'un client PostgreSQL : permet de tester sans vraie base. */
export type Queryable = {
  query: (text: string, values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export type CreateUserInput = {
  /** Email déjà normalisé (voir `emailSchema`). */
  email: string;
  /** Hash argon2id, jamais le mot de passe. */
  passwordHash: string;
  role: UserRole;
  /** Nom et prénom (validés par `profileSchema`), ou `null` tous les deux (premier admin). */
  firstname: string | null;
  lastname: string | null;
};

/** Nom et prénom validés par `profileSchema`. */
export type UserProfile = {
  firstname: string;
  lastname: string;
};

export type CreatedUser = {
  id: string;
  email: string;
  role: UserRole;
};

/** Données nécessaires à la vérification d'un mot de passe. Ne jamais logger. */
export type UserCredentials = {
  userId: string;
  passwordHash: string;
  /** État du compte (bloc 10) : un compte coupé ne se connecte pas, même avec le bon mot de passe. */
  state: AccountStateColumns;
};

/** L'email est déjà pris (unicité insensible à la casse, index `user_email_lower_key`). */
export class EmailAlreadyUsedError extends Error {
  constructor() {
    super("email_already_used");
    this.name = "EmailAlreadyUsedError";
  }
}

const PG_UNIQUE_VIOLATION = "23505";

// Valide la ligne renvoyée par la base avant de s'en servir comme type applicatif.
const userRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: userRoleSchema,
});

const credentialsRowSchema = z.object({
  id: z.uuid(),
  password_hash: z.string(),
  blocked_at: z.date().nullable(),
  blocked_until: z.date().nullable(),
  deletion_due_at: z.date().nullable(),
});

const idRowSchema = z.object({
  id: z.uuid(),
});

const emailRowSchema = z.object({
  email: z.string(),
});

const INSERT_USER_SQL = `INSERT INTO "user" (email, password_hash, role, firstname, lastname)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, role`;

// `lower(...)` des deux côtés : correspond à l'index d'unicité `user_email_lower_key`.
const FIND_CREDENTIALS_SQL = `SELECT id, password_hash, blocked_at, blocked_until, deletion_due_at
FROM "user"
WHERE lower(email) = lower($1)`;

const FIND_ID_BY_EMAIL_SQL = `SELECT id FROM "user"
WHERE lower(email) = lower($1)`;

// Seul le compte de la session est modifié : `id` vient toujours de la session (§6.2).
const UPDATE_PROFILE_SQL = `UPDATE "user"
SET firstname = $2, lastname = $3
WHERE id = $1
RETURNING id`;

const UPDATE_PASSWORD_HASH_SQL = `UPDATE "user"
SET password_hash = $2
WHERE id = $1
RETURNING email`;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === PG_UNIQUE_VIOLATION;
}

/**
 * Crée un utilisateur. Lève `EmailAlreadyUsedError` si l'email existe déjà.
 * Les autres erreurs de la base sont relancées telles quelles.
 */
export async function createUser(db: Queryable, input: CreateUserInput): Promise<CreatedUser> {
  try {
    const result = await db.query(INSERT_USER_SQL, [
      input.email,
      input.passwordHash,
      input.role,
      input.firstname,
      input.lastname,
    ]);
    const row = userRowSchema.parse(result.rows[0]);
    return { id: row.id, email: row.email, role: row.role };
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      throw new EmailAlreadyUsedError();
    }
    throw error;
  }
}

/** Retrouve l'identifiant et le hash d'un utilisateur par son email, ou `null` s'il n'existe pas. */
export async function findUserCredentialsByEmail(
  db: Queryable,
  email: string,
): Promise<UserCredentials | null> {
  const result = await db.query(FIND_CREDENTIALS_SQL, [email]);
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  const parsed = credentialsRowSchema.parse(row);
  return {
    userId: parsed.id,
    passwordHash: parsed.password_hash,
    state: {
      blockedAt: parsed.blocked_at,
      blockedUntil: parsed.blocked_until,
      deletionDueAt: parsed.deletion_due_at,
    },
  };
}

/** Retrouve l'identifiant d'un utilisateur par son email, ou `null` (sans lire le hash). */
export async function findUserIdByEmail(db: Queryable, email: string): Promise<string | null> {
  const result = await db.query(FIND_ID_BY_EMAIL_SQL, [email]);
  const row = result.rows[0];
  return row === undefined ? null : idRowSchema.parse(row).id;
}

/**
 * Remplace le hash du mot de passe. Renvoie l'email du compte (pour l'alerte de sécurité),
 * ou `null` si l'utilisateur n'existe pas.
 */
export async function updateUserPasswordHash(
  db: Queryable,
  userId: string,
  passwordHash: string,
): Promise<{ email: string } | null> {
  const result = await db.query(UPDATE_PASSWORD_HASH_SQL, [userId, passwordHash]);
  const row = result.rows[0];
  return row === undefined ? null : emailRowSchema.parse(row);
}

/**
 * Enregistre le nom et le prénom de l'utilisateur. Renvoie `false` si le compte
 * n'existe plus (supprimé entre-temps).
 */
export async function updateUserProfile(
  db: Queryable,
  userId: string,
  profile: UserProfile,
): Promise<boolean> {
  const result = await db.query(UPDATE_PROFILE_SQL, [userId, profile.firstname, profile.lastname]);
  return result.rows.length > 0;
}
