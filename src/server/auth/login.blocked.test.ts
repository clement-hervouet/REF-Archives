import { describe, expect, it } from "vitest";
import type { UserCredentials } from "../db/users";
import { authenticate } from "./login";
import type { AccountBlockedEvent, LoginDeps } from "./login";
import { loginKeys } from "./rate-limit";
import type { AttemptDecision } from "./rate-limit";

const NOW = new Date("2026-11-03T10:00:00Z");
const EMAIL = "arbitre@example.com";
const IP = "203.0.113.7";
const USER_ID = "3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69";
const SESSION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const { ipKey, accountKey } = loginKeys(IP, EMAIL);

const existingAccount: UserCredentials = { userId: USER_ID, passwordHash: "hash" };

type Options = {
  decision?: AttemptDecision;
  credentials?: UserCredentials | null;
  passwordValid?: boolean;
  withHook?: boolean;
};

function build(options: Options = {}) {
  const {
    decision = { admitted: true },
    credentials = existingAccount,
    passwordValid = false,
    withHook = true,
  } = options;
  const events: AccountBlockedEvent[] = [];
  const cleared: string[] = [];
  const deps: LoginDeps = {
    admitAttempt: () => Promise.resolve(decision),
    findCredentials: () => Promise.resolve(credentials),
    verifyPassword: () => Promise.resolve(passwordValid),
    verifyAgainstDummyHash: () => Promise.resolve(false),
    clearAttempts: (key) => {
      cleared.push(key);
      return Promise.resolve();
    },
    createSession: () => Promise.resolve({ id: SESSION_ID }),
    now: () => NOW,
    ...(withHook
      ? {
          onAccountBlocked: (event: AccountBlockedEvent) => {
            events.push(event);
          },
        }
      : {}),
  };
  return { deps, events, cleared };
}

const attempt = { email: EMAIL, password: "mauvais", ip: IP };

const accountJustBlocked: AttemptDecision = {
  admitted: true,
  newlyBlocked: [{ key: accountKey, retryAfterSeconds: 900 }],
};

describe("authenticate — alerte de blocage", () => {
  it("alerte quand l'échec bloque un compte existant", async () => {
    const { deps, events } = build({ decision: accountJustBlocked });
    const result = await authenticate(deps, attempt);
    expect(result).toEqual({ status: "invalid_credentials" });
    expect(events).toEqual([{ email: EMAIL, retryAfterSeconds: 900 }]);
  });

  it("n'alerte pas si le compte n'existe pas (aucun email vers une adresse inconnue)", async () => {
    const { deps, events } = build({ decision: accountJustBlocked, credentials: null });
    const result = await authenticate(deps, attempt);
    expect(result).toEqual({ status: "invalid_credentials" });
    expect(events).toHaveLength(0);
  });

  it("n'alerte pas si la 5e tentative réussit : le blocage est effacé", async () => {
    const { deps, events, cleared } = build({ decision: accountJustBlocked, passwordValid: true });
    const result = await authenticate(deps, { ...attempt, password: "bon" });
    expect(result).toEqual({ status: "success", userId: USER_ID, sessionId: SESSION_ID });
    expect(events).toHaveLength(0);
    expect(cleared).toEqual([accountKey]);
  });

  it("n'alerte pas quand seule l'IP vient d'être bloquée", async () => {
    const { deps, events } = build({
      decision: { admitted: true, newlyBlocked: [{ key: ipKey, retryAfterSeconds: 900 }] },
    });
    await authenticate(deps, attempt);
    expect(events).toHaveLength(0);
  });

  it("n'alerte pas quand aucun blocage ne commence", async () => {
    const { deps, events } = build();
    await authenticate(deps, attempt);
    expect(events).toHaveLength(0);
  });

  it("n'alerte pas quand la tentative est refusée (déjà bloqué)", async () => {
    const { deps, events } = build({ decision: { admitted: false, retryAfterSeconds: 600 } });
    const result = await authenticate(deps, attempt);
    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 600 });
    expect(events).toHaveLength(0);
  });

  it("fonctionne sans hook d'alerte (dépendance optionnelle)", async () => {
    const { deps } = build({ decision: accountJustBlocked, withHook: false });
    const result = await authenticate(deps, attempt);
    expect(result).toEqual({ status: "invalid_credentials" });
  });
});
