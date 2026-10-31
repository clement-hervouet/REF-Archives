import { describe, expect, it, vi } from "vitest";
import { authenticate } from "./login";
import type { LoginDeps } from "./login";

const NOW = new Date("2026-11-01T10:00:00.000Z");
const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const SESSION_ID = "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33";
const ATTEMPT = {
  email: "clem@example.com",
  password: "correct horse battery staple",
  ip: "203.0.113.7",
};

function makeDeps() {
  return {
    admitAttempt: vi.fn<LoginDeps["admitAttempt"]>().mockResolvedValue({ admitted: true }),
    findCredentials: vi
      .fn<LoginDeps["findCredentials"]>()
      .mockResolvedValue({ userId: USER_ID, passwordHash: "hash" }),
    verifyPassword: vi.fn<LoginDeps["verifyPassword"]>().mockResolvedValue(true),
    verifyAgainstDummyHash: vi.fn<LoginDeps["verifyAgainstDummyHash"]>().mockResolvedValue(false),
    clearAttempts: vi.fn<LoginDeps["clearAttempts"]>().mockResolvedValue(undefined),
    createSession: vi.fn<LoginDeps["createSession"]>().mockResolvedValue({ id: SESSION_ID }),
    now: () => NOW,
  } satisfies LoginDeps;
}

describe("authenticate", () => {
  it("connecte l'utilisateur et crée la session", async () => {
    const deps = makeDeps();
    expect(await authenticate(deps, ATTEMPT)).toEqual({
      status: "success",
      userId: USER_ID,
      sessionId: SESSION_ID,
    });
    expect(deps.createSession).toHaveBeenCalledTimes(1);
    expect(deps.createSession.mock.lastCall?.[0]).toBe(USER_ID);
    expect(deps.verifyPassword.mock.lastCall).toEqual(["hash", ATTEMPT.password]);
    expect(deps.verifyAgainstDummyHash).not.toHaveBeenCalled();
  });

  it("compte la tentative avec les clés IP et compte, sans données en clair", async () => {
    const deps = makeDeps();
    await authenticate(deps, ATTEMPT);
    const keys = deps.admitAttempt.mock.lastCall?.[0] ?? [];
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^login:ip:/);
    expect(keys[1]).toMatch(/^login:account:/);
    for (const key of keys) {
      expect(key).not.toContain(ATTEMPT.email);
      expect(key).not.toContain(ATTEMPT.ip);
    }
    expect(deps.admitAttempt.mock.lastCall?.[1]).toBe(NOW);
  });

  it("efface uniquement le compteur du compte après un succès", async () => {
    const deps = makeDeps();
    await authenticate(deps, ATTEMPT);
    expect(deps.clearAttempts).toHaveBeenCalledTimes(1);
    expect(deps.clearAttempts.mock.lastCall?.[0]).toMatch(/^login:account:/);
  });

  it("refuse un mauvais mot de passe sans créer de session ni effacer de compteur", async () => {
    const deps = makeDeps();
    deps.verifyPassword.mockResolvedValue(false);
    expect(await authenticate(deps, ATTEMPT)).toEqual({ status: "invalid_credentials" });
    expect(deps.createSession).not.toHaveBeenCalled();
    expect(deps.clearAttempts).not.toHaveBeenCalled();
  });

  it("refuse un email inconnu en dépensant le même calcul qu'un vrai compte", async () => {
    const deps = makeDeps();
    deps.findCredentials.mockResolvedValue(null);
    expect(await authenticate(deps, ATTEMPT)).toEqual({ status: "invalid_credentials" });
    expect(deps.verifyAgainstDummyHash).toHaveBeenCalledWith(ATTEMPT.password);
    expect(deps.verifyPassword).not.toHaveBeenCalled();
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("renvoie le même résultat pour un email inconnu et un mauvais mot de passe", async () => {
    const unknown = makeDeps();
    unknown.findCredentials.mockResolvedValue(null);
    const wrongPassword = makeDeps();
    wrongPassword.verifyPassword.mockResolvedValue(false);
    expect(await authenticate(unknown, ATTEMPT)).toEqual(
      await authenticate(wrongPassword, ATTEMPT),
    );
  });

  it("s'arrête dès que le rate limiting refuse, sans toucher à la base ni au hash", async () => {
    const deps = makeDeps();
    deps.admitAttempt.mockResolvedValue({ admitted: false, retryAfterSeconds: 840 });
    expect(await authenticate(deps, ATTEMPT)).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 840,
    });
    expect(deps.findCredentials).not.toHaveBeenCalled();
    expect(deps.verifyPassword).not.toHaveBeenCalled();
    expect(deps.verifyAgainstDummyHash).not.toHaveBeenCalled();
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("transmet l'email à la recherche de compte tel quel", async () => {
    const deps = makeDeps();
    await authenticate(deps, ATTEMPT);
    expect(deps.findCredentials).toHaveBeenCalledWith(ATTEMPT.email);
  });

  it("ne renvoie ni hash ni mot de passe dans le résultat", async () => {
    const result = await authenticate(makeDeps(), ATTEMPT);
    expect(JSON.stringify(result)).not.toContain("hash");
    expect(JSON.stringify(result)).not.toContain(ATTEMPT.password);
  });
});