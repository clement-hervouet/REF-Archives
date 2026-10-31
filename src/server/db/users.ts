/**
 * Requêtes SQL sur la table `"user"` (§3.2 : SQL à la main, toujours paramétré).
 */
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
});

const INSERT_USER_SQL = `INSERT INTO "user" (email, password_hash, role)
VALUES ($1, $2, $3)
RETURNING id, email, role`;

// `lower(...)` des deux côtés : correspond à l'index d'unicité `user_email_lower_key`.
const FIND_CREDENTIALS_SQL = `SELECT id, password_hash
FROM "user"
WHERE lower(email) = lower($1)`;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === PG_UNIQUE_VIOLATION;
}

/**
 * Crée un utilisateur. Lève `EmailAlreadyUsedError` si l'email existe déjà.
 * Les autres erreurs de la base sont relancées telles quelles.
 */
export async function createUser(db: Queryable, input: CreateUserInput): Promise<CreatedUser> {
  try {
    const result = await db.query(INSERT_USER_SQL, [input.email, input.passwordHash, input.role]);
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
  return { userId: parsed.id, passwordHash: parsed.password_hash };
}