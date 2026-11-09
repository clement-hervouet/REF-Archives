import { describe, expect, it, vi } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { runPurgeAccounts } from "./purge-accounts";

describe("runPurgeAccounts", () => {
  it("efface les comptes dus et journalise chaque suppression, sans identifiant", async () => {
    const { db, query } = makeFakeDb([
      { id: "00000000-0000-4000-8000-000000000002" },
      { id: "00000000-0000-4000-8000-000000000003" },
    ]);
    const recordDeleted = vi.fn().mockResolvedValue(undefined);
    expect(
      await runPurgeAccounts({
        transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
        recordDeleted,
      }),
    ).toEqual({ deleted: 2 });
    expect(query.mock.calls[0]?.[0]).toContain('DELETE FROM "user"');
    expect(recordDeleted).toHaveBeenCalledTimes(2);
    expect(recordDeleted.mock.calls[0]).toEqual([]);
  });

  it("rien à effacer : aucun événement", async () => {
    const { db } = makeFakeDb();
    const recordDeleted = vi.fn();
    expect(
      await runPurgeAccounts({
        transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
        recordDeleted,
      }),
    ).toEqual({ deleted: 0 });
    expect(recordDeleted).not.toHaveBeenCalled();
  });
});
