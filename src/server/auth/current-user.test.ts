import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import { resolveCurrentUser } from "./current-user";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const SESSION_ID = "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33";
const ACTIVE_ROW = {
  id: SESSION_ID,
  user_id: USER_ID,
  email: "clem@example.com",
  role: "admin",
};

describe("resolveCurrentUser", () => {
  it("renvoie l'utilisateur d'une session valide et met à jour last_seen_at", async () => {
    const { db, query } = makeFakeDb();
    query.mockResolvedValueOnce({ rows: [ACTIVE_ROW] }).mockResolvedValueOnce({ rows: [] });
    expect(await resolveCurrentUser(db, SESSION_ID)).toEqual({
      id: USER_ID,
      sessionId: SESSION_ID,
      email: "clem@example.com",
      role: "admin",
    });
    expect(query.mock.calls).toHaveLength(2);
    expect(query.mock.calls[1]?.[1]).toEqual([SESSION_ID]);
  });

  it("renvoie null pour une session inconnue, révoquée ou expirée, sans écrire en base", async () => {
    const { db, query } = makeFakeDb();
    expect(await resolveCurrentUser(db, SESSION_ID)).toBeNull();
    expect(query.mock.calls).toHaveLength(1);
  });

  it("renvoie null sans toucher à la base quand l'identifiant est absent", async () => {
    const { db, query } = makeFakeDb();
    expect(await resolveCurrentUser(db, undefined)).toBeNull();
    expect(await resolveCurrentUser(db, null)).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("renvoie null sans toucher à la base quand l'identifiant n'est pas un UUID", async () => {
    const { db, query } = makeFakeDb();
    expect(await resolveCurrentUser(db, "' OR 1=1 --")).toBeNull();
    expect(await resolveCurrentUser(db, 42)).toBeNull();
    expect(await resolveCurrentUser(db, "")).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("n'expose pas d'autres champs que ceux prévus", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [{ ...ACTIVE_ROW, password_hash: "secret" }] })
      .mockResolvedValueOnce({ rows: [] });
    const user = await resolveCurrentUser(db, SESSION_ID);
    expect(JSON.stringify(user)).not.toContain("secret");
  });
});