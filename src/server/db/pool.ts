/**
 * Accès à PostgreSQL : un pool partagé par le serveur Next.js.
 * Le pool est créé à la première utilisation, jamais à l'import (build, tests).
 */
import pg from "pg";
import { z } from "zod";
import type { Queryable } from "./users";

const databaseUrlSchema = z.url();

// En développement, le rechargement à chaud peut recréer ce module : les anciens
// pools se vident seuls (les connexions inactives sont fermées après 10 s par défaut).
let pool: pg.Pool | undefined;

function getPool(): pg.Pool {
  // DATABASE_URL a déjà été validée au démarrage par `src/lib/env.ts` (fail fast).
  pool ??= new pg.Pool({
    connectionString: databaseUrlSchema.parse(process.env.DATABASE_URL),
    max: 10,
  });
  return pool;
}

/** Exécute une requête hors transaction. */
export function getDb(): Queryable {
  const currentPool = getPool();
  return {
    query: (text, values) => currentPool.query<Record<string, unknown>>(text, values),
  };
}

/**
 * Exécute `action` dans une transaction : COMMIT si elle réussit, ROLLBACK si elle
 * lève une erreur. La connexion est toujours rendue au pool.
 */
export async function withTransaction<T>(action: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const db: Queryable = {
    query: (text, values) => client.query<Record<string, unknown>>(text, values),
  };
  try {
    await client.query("BEGIN");
    const result = await action(db);
    await client.query("COMMIT");
    return result;
  } catch (error: unknown) {
    // Si le ROLLBACK échoue lui aussi, on garde l'erreur d'origine.
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}