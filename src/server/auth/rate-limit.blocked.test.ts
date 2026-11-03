import { describe, expect, it } from "vitest";
import { admitAttempt } from "./rate-limit";
import type { RateLimitStore } from "./rate-limit";
import type { RateLimitState } from "./rate-limit-policy";

const NOW = new Date("2026-11-03T10:00:00Z");
const MINUTE_MS = 60_000;
const KEY_A = "login:ip:aaa";
const KEY_B = "login:account:bbb";

/** État « 4 échecs dans la fenêtre » : la prochaine tentative atteint la limite de 5. */
function fourFailures(strikes = 0, blockedUntil: Date | null = null): RateLimitState {
  return {
    attempts: 4,
    strikes,
    windowStartedAt: new Date(NOW.getTime() - MINUTE_MS),
    blockedUntil,
  };
}

function fakeStore(initial: Record<string, RateLimitState>): {
  store: RateLimitStore;
  saved: Map<string, RateLimitState>;
} {
  const saved = new Map<string, RateLimitState>();
  const store: RateLimitStore = {
    lock: (keys) => {
      const states = new Map<string, RateLimitState>();
      for (const key of keys) {
        const state = initial[key];
        if (state !== undefined) {
          states.set(key, state);
        }
      }
      return Promise.resolve(states);
    },
    save: (key, state) => {
      saved.set(key, state);
      return Promise.resolve();
    },
  };
  return { store, saved };
}

describe("admitAttempt — blocages déclenchés", () => {
  it("n'ajoute pas newlyBlocked tant qu'aucun blocage ne commence", async () => {
    const { store } = fakeStore({});
    const decision = await admitAttempt(store, [KEY_A, KEY_B], NOW);
    expect(decision).toEqual({ admitted: true });
  });

  it("signale la clé qui atteint la limite, avec la durée du blocage (15 min au premier)", async () => {
    const { store, saved } = fakeStore({ [KEY_B]: fourFailures() });
    const decision = await admitAttempt(store, [KEY_A, KEY_B], NOW);
    expect(decision).toEqual({
      admitted: true,
      newlyBlocked: [{ key: KEY_B, retryAfterSeconds: 900 }],
    });
    expect(saved.get(KEY_B)?.blockedUntil).not.toBeNull();
    expect(saved.get(KEY_A)?.blockedUntil).toBeNull();
  });

  it("signale plusieurs clés si elles atteignent la limite ensemble", async () => {
    const { store } = fakeStore({ [KEY_A]: fourFailures(), [KEY_B]: fourFailures() });
    const decision = await admitAttempt(store, [KEY_A, KEY_B], NOW);
    expect(decision).toEqual({
      admitted: true,
      newlyBlocked: [
        { key: KEY_A, retryAfterSeconds: 900 },
        { key: KEY_B, retryAfterSeconds: 900 },
      ],
    });
  });

  it("double la durée au blocage suivant (30 min au deuxième)", async () => {
    const expiredBlock = new Date(NOW.getTime() - 1000);
    const { store } = fakeStore({ [KEY_B]: fourFailures(1, expiredBlock) });
    const decision = await admitAttempt(store, [KEY_B], NOW);
    expect(decision).toEqual({
      admitted: true,
      newlyBlocked: [{ key: KEY_B, retryAfterSeconds: 1800 }],
    });
  });

  it("ne signale rien et n'incrémente rien si une clé est déjà bloquée", async () => {
    const stillBlocked: RateLimitState = {
      attempts: 0,
      strikes: 1,
      windowStartedAt: NOW,
      blockedUntil: new Date(NOW.getTime() + 10 * MINUTE_MS),
    };
    const { store, saved } = fakeStore({ [KEY_B]: stillBlocked });
    const decision = await admitAttempt(store, [KEY_A, KEY_B], NOW);
    expect(decision).toEqual({ admitted: false, retryAfterSeconds: 600 });
    expect(saved.size).toBe(0);
  });
});