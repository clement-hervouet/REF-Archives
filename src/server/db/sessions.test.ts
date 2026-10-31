import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  SESSION_MAX_AGE_SECONDS,
  createSession,
  findActiveSession,
  revokeAllUserSessions,
  revokeSession,
  touchSession,
} from "./sessions";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const SESSION_ID = "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33";
const OTHER_SESSION_ID = "5b1e8a07-3c44-4d9b-8f12-7a6d0c9e2f44";

describe("createSession", () => {
  it("renvoie l'identifiant et la date d'expiration", async () => {
    const expiresAt = new Date("2026-12-01T10:00:00.000Z");
    const { db } = makeFakeDb([{ id: SESSION_ID, expires_at: expiresAt }]);
    expect(await createSession(db, USER_ID)).toEqual({ id: SESSION_ID, expiresAt });
  });

  it("passe l'utilisateur et la durée de vie en paramètres", async () => {
    const { db, query } = makeFakeDb([{ id: SESSION_ID, expires_at: new Date() }]);
    await createSession(db, USER_ID);
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID, SESSION_MAX_AGE_SECONDS]);
  });

  it("refuse une réponse sans ligne", async () => {
    const { db } = makeFakeDb();
    await expect(createSession(db, USER_ID)).rejects.toThrow();
  });
});

describe("findActiveSession", () => {
  it("renvoie la session et l'utilisateur associé", async () => {
    const { db } = makeFakeDb([
      { id: SESSION_ID, user_id: USER_ID, email: "clem@example.com", role: "admin" },
    ]);
    expect(await findActiveSession(db, SESSION_ID)).toEqual({
      sessionId: SESSION_ID,
      userId: USER_ID,
      email: "clem@example.com",
      role: "admin",
    });
  });

  it("renvoie null quand aucune session valide ne correspond", async () => {
    const { db } = makeFakeDb();
    expect(await findActiveSession(db, SESSION_ID)).toBeNull();
  });

  it("exclut les sessions révoquées et expirées dans la requête", async () => {
    const { db, query } = makeFakeDb();
    await findActiveSession(db, SESSION_ID);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("revoked_at IS NULL");
    expect(call?.[0]).toContain("expires_at > now()");
    expect(call?.[1]).toEqual([SESSION_ID]);
  });

  it("refuse une ligne dont le rôle est inconnu", async () => {
    const { db } = makeFakeDb([
      { id: SESSION_ID, user_id: USER_ID, email: "clem@example.com", role: "root" },
    ]);
    await expect(findActiveSession(db, SESSION_ID)).rejects.toThrow();
  });
});

describe("touchSession", () => {
  it("met à jour la session visée, avec limitation dans la requête", async () => {
    const { db, query } = makeFakeDb();
    await touchSession(db, SESSION_ID);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("last_seen_at < now() - interval '5 minutes'");
    expect(call?.[1]).toEqual([SESSION_ID]);
  });
});

describe("revokeSession", () => {
  it("révoque uniquement la session visée", async () => {
    const { db, query } = makeFakeDb();
    await revokeSession(db, SESSION_ID);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("revoked_at = now()");
    expect(call?.[0]).toContain("revoked_at IS NULL");
    expect(call?.[1]).toEqual([SESSION_ID]);
  });
});

describe("revokeAllUserSessions", () => {
  it("révoque toutes les sessions de l'utilisateur quand rien n'est excepté", async () => {
    const { db, query } = makeFakeDb();
    await revokeAllUserSessions(db, USER_ID, null);
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID, null]);
  });

  it("peut conserver la session courante", async () => {
    const { db, query } = makeFakeDb();
    await revokeAllUserSessions(db, USER_ID, OTHER_SESSION_ID);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("id <> $2::uuid");
    expect(call?.[1]).toEqual([USER_ID, OTHER_SESSION_ID]);
  });

  it("filtre toujours par utilisateur", async () => {
    const { db, query } = makeFakeDb();
    await revokeAllUserSessions(db, USER_ID, null);
    expect(query.mock.lastCall?.[0]).toContain("user_id = $1");
  });
});