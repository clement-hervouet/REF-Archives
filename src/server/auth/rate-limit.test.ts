import { describe, expect, it, vi } from "vitest";
import { admitAttempt, hashIdentifier, loginKeys } from "./rate-limit";
import type { RateLimitStore } from "./rate-limit";
import type { RateLimitState } from "./rate-limit-policy";

const MINUTE = 60 * 1000;
const T0 = new Date("2026-11-01T10:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(T0.getTime() + offsetMs);
}

/** Magasin en mémoire, avec les mêmes contrats que la version PostgreSQL. */
function makeStore() {
  const data = new Map<string, RateLimitState>();
  const lock = vi.fn<RateLimitStore["lock"]>((keys) => {
    const result = new Map<string, RateLimitState>();
    for (const key of keys) {
      const state = data.get(key);
      if (state !== undefined) {
        result.set(key, state);
      }
    }
    return Promise.resolve(result);
  });
  const save = vi.fn<RateLimitStore["save"]>((key, state) => {
    data.set(key, state);
    return Promise.resolve();
  });
  return { store: { lock, save } satisfies RateLimitStore, data, save };
}

describe("hashIdentifier", () => {
  it("produit un SHA-256 hexadécimal de 64 caractères", () => {
    expect(hashIdentifier("clem@example.com")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("est déterministe et sensible à la valeur", () => {
    expect(hashIdentifier("a")).toBe(hashIdentifier("a"));
    expect(hashIdentifier("a")).not.toBe(hashIdentifier("b"));
  });

  it("donne le SHA-256 attendu (vecteur de test connu)", () => {
    expect(hashIdentifier("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("loginKeys", () => {
  it("préfixe les clés et n'y met ni l'IP ni l'email en clair", () => {
    const { ipKey, accountKey } = loginKeys("203.0.113.7", "clem@example.com");
    expect(ipKey).toMatch(/^login:ip:[0-9a-f]{64}$/);
    expect(accountKey).toMatch(/^login:account:[0-9a-f]{64}$/);
    expect(ipKey).not.toContain("203.0.113.7");
    expect(accountKey).not.toContain("clem");
  });

  it("reste sous la limite de 200 caractères de la table", () => {
    const { ipKey, accountKey } = loginKeys("203.0.113.7", "clem@example.com");
    expect(ipKey.length).toBeLessThanOrEqual(200);
    expect(accountKey.length).toBeLessThanOrEqual(200);
  });

  it("sépare les clés de deux comptes et de deux IP", () => {
    expect(loginKeys("1.1.1.1", "a@example.com").accountKey).not.toBe(
      loginKeys("1.1.1.1", "b@example.com").accountKey,
    );
    expect(loginKeys("1.1.1.1", "a@example.com").ipKey).not.toBe(
      loginKeys("2.2.2.2", "a@example.com").ipKey,
    );
  });
});

describe("admitAttempt", () => {
  it("admet la première tentative et la compte", async () => {
    const { store, data } = makeStore();
    expect(await admitAttempt(store, ["k"], T0)).toEqual({ admitted: true });
    expect(data.get("k")?.attempts).toBe(1);
  });

  it("admet 5 tentatives puis refuse la 6e", async () => {
    const { store } = makeStore();
    const decisions = [];
    for (let index = 0; index < 6; index += 1) {
      decisions.push(await admitAttempt(store, ["k"], at(index * MINUTE)));
    }
    expect(decisions.slice(0, 5).every((decision) => decision.admitted)).toBe(true);
    // Blocage posé à t = 4 min pour 15 min : il reste 14 min à t = 5 min.
    expect(decisions[5]).toEqual({ admitted: false, retryAfterSeconds: 14 * 60 });
  });

  it("n'incrémente rien quand la tentative est refusée", async () => {
    const { store, save } = makeStore();
    for (let index = 0; index < 5; index += 1) {
      await admitAttempt(store, ["k"], at(index * MINUTE));
    }
    const savesBefore = save.mock.calls.length;
    await admitAttempt(store, ["k"], at(6 * MINUTE));
    expect(save.mock.calls).toHaveLength(savesBefore);
  });

  it("refuse tout si une seule des clés est bloquée, sans compter l'autre", async () => {
    const { store, data } = makeStore();
    for (let index = 0; index < 5; index += 1) {
      await admitAttempt(store, ["ip"], at(index * MINUTE));
    }
    const decision = await admitAttempt(store, ["ip", "account"], at(6 * MINUTE));
    expect(decision.admitted).toBe(false);
    expect(data.has("account")).toBe(false);
  });

  it("compte la tentative sur toutes les clés quand elle est admise", async () => {
    const { store, data } = makeStore();
    await admitAttempt(store, ["ip", "account"], T0);
    expect(data.get("ip")?.attempts).toBe(1);
    expect(data.get("account")?.attempts).toBe(1);
  });

  it("admet de nouveau une fois le blocage terminé", async () => {
    const { store } = makeStore();
    for (let index = 0; index < 5; index += 1) {
      await admitAttempt(store, ["k"], at(index * MINUTE));
    }
    const decision = await admitAttempt(store, ["k"], at(4 * MINUTE + 15 * MINUTE + 1));
    expect(decision).toEqual({ admitted: true });
  });

  it("renvoie la plus longue attente quand plusieurs clés sont bloquées", async () => {
    const { store, data } = makeStore();
    data.set("short", {
      attempts: 0,
      strikes: 1,
      windowStartedAt: T0,
      blockedUntil: at(5 * MINUTE),
    });
    data.set("long", {
      attempts: 0,
      strikes: 1,
      windowStartedAt: T0,
      blockedUntil: at(10 * MINUTE),
    });
    expect(await admitAttempt(store, ["short", "long"], T0)).toEqual({
      admitted: false,
      retryAfterSeconds: 10 * 60,
    });
  });
});