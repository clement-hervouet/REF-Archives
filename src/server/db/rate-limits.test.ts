import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import { deleteRateLimit, lockRateLimits, saveRateLimit } from "./rate-limits";

const T0 = new Date("2026-11-01T10:00:00.000Z");
const T1 = new Date("2026-11-01T10:15:00.000Z");

describe("lockRateLimits", () => {
  it("crée les lignes manquantes puis les verrouille, avec les clés triées et dédoublonnées", async () => {
    const { db, query } = makeFakeDb();
    await lockRateLimits(db, ["b", "a", "b"]);
    expect(query.mock.calls).toHaveLength(2);
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (key) DO NOTHING");
    expect(query.mock.calls[0]?.[1]).toEqual([["a", "b"]]);
    expect(query.mock.calls[1]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[1]?.[0]).toContain("ORDER BY key");
    expect(query.mock.calls[1]?.[1]).toEqual([["a", "b"]]);
  });

  it("convertit les lignes en états", async () => {
    const { db } = makeFakeDb([
      { key: "a", attempts: 2, strikes: 0, window_started_at: T0, blocked_until: null },
      { key: "b", attempts: 0, strikes: 1, window_started_at: T0, blocked_until: T1 },
    ]);
    const states = await lockRateLimits(db, ["a", "b"]);
    expect(states.get("a")).toEqual({
      attempts: 2,
      strikes: 0,
      windowStartedAt: T0,
      blockedUntil: null,
    });
    expect(states.get("b")).toEqual({
      attempts: 0,
      strikes: 1,
      windowStartedAt: T0,
      blockedUntil: T1,
    });
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([
      { key: "a", attempts: "beaucoup", strikes: 0, window_started_at: T0, blocked_until: null },
    ]);
    await expect(lockRateLimits(db, ["a"])).rejects.toThrow();
  });
});

describe("saveRateLimit", () => {
  it("écrit l'état complet de la clé", async () => {
    const { db, query } = makeFakeDb();
    await saveRateLimit(db, "a", {
      attempts: 3,
      strikes: 1,
      windowStartedAt: T0,
      blockedUntil: T1,
    });
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("WHERE key = $1");
    expect(call?.[1]).toEqual(["a", 3, 1, T0, T1]);
  });

  it("accepte l'absence de blocage", async () => {
    const { db, query } = makeFakeDb();
    await saveRateLimit(db, "a", {
      attempts: 1,
      strikes: 0,
      windowStartedAt: T0,
      blockedUntil: null,
    });
    expect(query.mock.lastCall?.[1]).toEqual(["a", 1, 0, T0, null]);
  });
});

describe("deleteRateLimit", () => {
  it("supprime uniquement la clé donnée", async () => {
    const { db, query } = makeFakeDb();
    await deleteRateLimit(db, "a");
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("WHERE key = $1");
    expect(call?.[1]).toEqual(["a"]);
  });
});