import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { runPurgeData } from "./purge-data";

/** Transaction factice : exécute l'action sur le faux client. */
function fakeTransaction(db: Queryable) {
  return <T>(action: (tx: Queryable) => Promise<T>) => action(db);
}

describe("runPurgeData", () => {
  it("purge tout dans une seule transaction et renvoie les nombres par catégorie", async () => {
    const { db, query } = makeFakeDb([{ count: 1 }]);
    // Le nombre de transactions ouvertes est compté ici (un mock perdrait le type générique).
    let transactions = 0;
    const transaction = <T>(action: (tx: Queryable) => Promise<T>) => {
      transactions += 1;
      return action(db);
    };
    expect(await runPurgeData({ transaction })).toEqual({
      compensations: 1,
      notes: 1,
      games: 1,
      scales: 1,
      securityEvents: 1,
      reminderDispatches: 1,
      sessions: 1,
      invitations: 1,
      passwordResets: 1,
      rateLimits: 1,
    });
    expect(transactions).toBe(1);
    expect(query).toHaveBeenCalledTimes(10);
  });

  it("efface les indemnités avant les barèmes (une indemnité supprimée protège son barème)", async () => {
    const { db, query } = makeFakeDb([{ count: 0 }]);
    await runPurgeData({ transaction: fakeTransaction(db) });
    const statements = query.mock.calls.map(([sql]) => sql);
    const compensations = statements.findIndex((sql) => sql.includes("DELETE FROM compensation"));
    const scales = statements.findIndex((sql) => sql.includes("DELETE FROM scale"));
    expect(compensations).toBeGreaterThanOrEqual(0);
    expect(scales).toBeGreaterThan(compensations);
  });

  it("applique les durées décidées : 30 jours, 90 pour le journal, 24 h pour les compteurs", async () => {
    const { db, query } = makeFakeDb([{ count: 0 }]);
    await runPurgeData({ transaction: fakeTransaction(db) });
    const valuesOf = (table: string) =>
      query.mock.calls.find(([sql]) => sql.includes(`DELETE FROM ${table}`))?.[1];
    expect(valuesOf("compensation")).toEqual([30]);
    expect(valuesOf("note")).toEqual([30]);
    expect(valuesOf("game")).toEqual([30]);
    expect(valuesOf("scale")).toEqual([30]);
    expect(valuesOf("security_event")).toEqual([90]);
    expect(valuesOf("reminder_dispatch")).toEqual([30]);
    expect(valuesOf("session")).toEqual([30]);
    expect(valuesOf("invitation")).toEqual([30]);
    expect(valuesOf("password_reset")).toEqual([]);
    expect(valuesOf("rate_limit")).toEqual([86_400]);
  });

  it("une erreur de base remonte (la transaction est annulée par l'appelant)", async () => {
    const { db, query } = makeFakeDb([{ count: 0 }]);
    query.mockRejectedValueOnce(new Error("panne"));
    await expect(runPurgeData({ transaction: fakeTransaction(db) })).rejects.toThrow("panne");
  });
});
