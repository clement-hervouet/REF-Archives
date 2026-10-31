/**
 * Faux client PostgreSQL pour les tests unitaires de `src/server/db/` (tests uniquement).
 */
import { vi } from "vitest";
import type { Queryable } from "./users";

/** Chaque appel à `query` renvoie `rows`, sauf si le test redéfinit le mock. */
export function makeFakeDb(rows: Record<string, unknown>[] = []) {
  const query = vi.fn<Queryable["query"]>().mockResolvedValue({ rows });
  return { db: { query } satisfies Queryable, query };
}