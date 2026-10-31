import { describe, expect, it } from "vitest";
import {
  RATE_LIMIT_BASE_DELAY_MS,
  RATE_LIMIT_MAX_DELAY_MS,
  RATE_LIMIT_MEMORY_MS,
  RATE_LIMIT_WINDOW_MS,
  getBlockDelayMs,
  getRetryAfterSeconds,
  recordFailure,
} from "./rate-limit-policy";
import type { RateLimitState } from "./rate-limit-policy";

const MINUTE = 60 * 1000;
const T0 = new Date("2026-11-01T10:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(T0.getTime() + offsetMs);
}

/** Enchaîne `count` échecs, un par minute à partir de `startOffsetMs`. */
function failTimes(state: RateLimitState | null, count: number, startOffsetMs = 0): RateLimitState {
  let current = state;
  for (let index = 0; index < count; index += 1) {
    current = recordFailure(current, at(startOffsetMs + index * MINUTE));
  }
  if (current === null) {
    throw new Error("count doit être ≥ 1");
  }
  return current;
}

describe("getBlockDelayMs", () => {
  it("vaut 15 min au premier blocage puis double", () => {
    expect(getBlockDelayMs(1)).toBe(15 * MINUTE);
    expect(getBlockDelayMs(2)).toBe(30 * MINUTE);
    expect(getBlockDelayMs(3)).toBe(60 * MINUTE);
  });

  it("est plafonné à 24 h", () => {
    expect(getBlockDelayMs(20)).toBe(RATE_LIMIT_MAX_DELAY_MS);
    expect(getBlockDelayMs(10_000)).toBe(RATE_LIMIT_MAX_DELAY_MS);
  });

  it("ne descend pas sous le délai de base", () => {
    expect(getBlockDelayMs(0)).toBe(RATE_LIMIT_BASE_DELAY_MS);
  });
});

describe("getRetryAfterSeconds", () => {
  it("renvoie 0 sans état", () => {
    expect(getRetryAfterSeconds(null, T0)).toBe(0);
  });

  it("renvoie 0 si aucun blocage n'est posé", () => {
    expect(getRetryAfterSeconds(failTimes(null, 2), T0)).toBe(0);
  });

  it("renvoie le temps restant, arrondi au-dessus", () => {
    const state: RateLimitState = {
      attempts: 0,
      strikes: 1,
      windowStartedAt: T0,
      blockedUntil: at(1500),
    };
    expect(getRetryAfterSeconds(state, T0)).toBe(2);
  });

  it("renvoie 0 quand le blocage est terminé (limite incluse)", () => {
    const state: RateLimitState = {
      attempts: 0,
      strikes: 1,
      windowStartedAt: T0,
      blockedUntil: at(RATE_LIMIT_BASE_DELAY_MS),
    };
    expect(getRetryAfterSeconds(state, at(RATE_LIMIT_BASE_DELAY_MS))).toBe(0);
    expect(getRetryAfterSeconds(state, at(RATE_LIMIT_BASE_DELAY_MS + 1))).toBe(0);
  });
});

describe("recordFailure", () => {
  it("compte les échecs sans bloquer avant le 5e", () => {
    const state = failTimes(null, 4);
    expect(state.attempts).toBe(4);
    expect(state.blockedUntil).toBeNull();
  });

  it("bloque 15 min au 5e échec", () => {
    const state = failTimes(null, 5);
    expect(state.strikes).toBe(1);
    expect(state.attempts).toBe(0);
    expect(state.blockedUntil).toEqual(at(4 * MINUTE + RATE_LIMIT_BASE_DELAY_MS));
  });

  it("ne modifie pas l'état pendant un blocage actif", () => {
    const blocked = failTimes(null, 5);
    const during = recordFailure(blocked, at(5 * MINUTE));
    expect(during).toBe(blocked);
  });

  it("double le délai au blocage suivant", () => {
    const first = failTimes(null, 5);
    const afterBlock = 4 * MINUTE + RATE_LIMIT_BASE_DELAY_MS + MINUTE;
    const second = failTimes(first, 5, afterBlock);
    expect(second.strikes).toBe(2);
    expect(second.blockedUntil).toEqual(at(afterBlock + 4 * MINUTE + 30 * MINUTE));
  });

  it("repart à zéro quand la fenêtre de 15 min est écoulée", () => {
    const state = failTimes(null, 3);
    const later = recordFailure(state, at(RATE_LIMIT_WINDOW_MS + MINUTE));
    expect(later.attempts).toBe(1);
    expect(later.windowStartedAt).toEqual(at(RATE_LIMIT_WINDOW_MS + MINUTE));
    expect(later.blockedUntil).toBeNull();
  });

  it("conserve la fenêtre tant qu'elle n'est pas écoulée", () => {
    const state = failTimes(null, 3);
    const next = recordFailure(state, at(10 * MINUTE));
    expect(next.attempts).toBe(4);
    expect(next.windowStartedAt).toEqual(T0);
  });

  it("des échecs étalés sur plus de 15 min ne bloquent pas", () => {
    // Premier échec hors de la boucle : `state` est ainsi typé sans `null`.
    let state = recordFailure(null, T0);
    for (let index = 1; index < 10; index += 1) {
      state = recordFailure(state, at(index * 16 * MINUTE));
    }
    expect(state.blockedUntil).toBeNull();
    expect(state.attempts).toBe(1);
  });

  it("oublie les blocages passés après 24 h d'inactivité", () => {
    const blocked = failTimes(null, 5);
    const farLater = at(4 * MINUTE + RATE_LIMIT_BASE_DELAY_MS + RATE_LIMIT_MEMORY_MS);
    const state = recordFailure(blocked, farLater);
    expect(state.strikes).toBe(0);
    expect(state.attempts).toBe(1);
  });

  it("garde les blocages passés si l'activité est récente", () => {
    const blocked = failTimes(null, 5);
    const justAfter = at(4 * MINUTE + RATE_LIMIT_BASE_DELAY_MS + MINUTE);
    const state = recordFailure(blocked, justAfter);
    expect(state.strikes).toBe(1);
    expect(state.attempts).toBe(1);
  });

  it("ne modifie pas l'état reçu (fonction pure)", () => {
    const state = failTimes(null, 2);
    const snapshot = { ...state };
    recordFailure(state, at(10 * MINUTE));
    expect(state).toEqual(snapshot);
  });
});