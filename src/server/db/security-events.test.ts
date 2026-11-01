import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import { insertSecurityEvent, securityEventTypeSchema } from "./security-events";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const IP_HASH = "a".repeat(64);

describe("insertSecurityEvent", () => {
  it("insère le type, l'utilisateur et l'empreinte d'IP, dans cet ordre", async () => {
    const { db, query } = makeFakeDb();
    await insertSecurityEvent(db, { type: "login_succeeded", userId: USER_ID, ipHash: IP_HASH });
    expect(query.mock.lastCall?.[1]).toEqual(["login_succeeded", USER_ID, IP_HASH]);
  });

  it("accepte un utilisateur et une IP inconnus", async () => {
    const { db, query } = makeFakeDb();
    await insertSecurityEvent(db, { type: "login_failed", userId: null, ipHash: null });
    expect(query.mock.lastCall?.[1]).toEqual(["login_failed", null, null]);
  });

  it("utilise une requête paramétrée, sans valeur dans le texte SQL", async () => {
    const { db, query } = makeFakeDb();
    await insertSecurityEvent(db, { type: "logout", userId: USER_ID, ipHash: IP_HASH });
    const sql = query.mock.lastCall?.[0];
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
    expect(sql).toContain("$3");
    expect(sql).not.toContain(USER_ID);
    expect(sql).not.toContain(IP_HASH);
  });

  it("relance les erreurs de la base", async () => {
    const { db, query } = makeFakeDb();
    const failure = new Error("connexion perdue");
    query.mockRejectedValue(failure);
    await expect(
      insertSecurityEvent(db, { type: "logout", userId: USER_ID, ipHash: null }),
    ).rejects.toBe(failure);
  });
});

describe("securityEventTypeSchema", () => {
  it("accepte les sept types d'événements", () => {
    for (const type of [
      "login_succeeded",
      "login_failed",
      "logout",
      "invitation_created",
      "invitation_revoked",
      "invitation_accepted",
      "invitation_rejected",
    ]) {
      expect(securityEventTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("refuse un type inconnu", () => {
    expect(securityEventTypeSchema.safeParse("password_changed").success).toBe(false);
  });
});