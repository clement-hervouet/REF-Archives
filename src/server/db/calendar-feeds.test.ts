import { ACTIVE_ACCOUNT_CONDITION } from "./account-state";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { hashToken } from "../auth/tokens";
import { makeFakeDb } from "./fake-db";
import {
  deleteCalendarFeed,
  findUserIdByCalendarToken,
  getCalendarFeedStatus,
  replaceCalendarFeed,
} from "./calendar-feeds";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const TOKEN_HASH = hashToken("jeton-de-test");
const CREATED_AT = new Date("2026-11-05T17:00:00.000Z");

describe("replaceCalendarFeed", () => {
  it("remplace l'empreinte du compte et renvoie la date de création", async () => {
    const { db, query } = makeFakeDb([{ created_at: CREATED_AT }]);
    expect(await replaceCalendarFeed(db, { userId: USER_ID, tokenHash: TOKEN_HASH })).toEqual({
      createdAt: CREATED_AT,
    });
    expect(query.mock.lastCall?.[0]).toContain("ON CONFLICT (user_id) DO UPDATE");
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID, TOKEN_HASH]);
  });

  it("refuse autre chose qu'une empreinte de 32 octets", async () => {
    const { db, query } = makeFakeDb();
    await expect(
      replaceCalendarFeed(db, { userId: USER_ID, tokenHash: Buffer.from("court") }),
    ).rejects.toThrow(ValidationError);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("deleteCalendarFeed", () => {
  it("renvoie true quand un lien a été révoqué", async () => {
    const { db, query } = makeFakeDb([{ user_id: USER_ID }]);
    expect(await deleteCalendarFeed(db, USER_ID)).toBe(true);
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID]);
  });

  it("renvoie false quand le compte n'avait pas de lien", async () => {
    const { db } = makeFakeDb();
    expect(await deleteCalendarFeed(db, USER_ID)).toBe(false);
  });
});

describe("getCalendarFeedStatus", () => {
  it("renvoie la date de création du lien", async () => {
    const { db } = makeFakeDb([{ created_at: CREATED_AT }]);
    expect(await getCalendarFeedStatus(db, USER_ID)).toEqual({ createdAt: CREATED_AT });
  });

  it("renvoie null sans lien", async () => {
    const { db } = makeFakeDb();
    expect(await getCalendarFeedStatus(db, USER_ID)).toBeNull();
  });
});

describe("findUserIdByCalendarToken", () => {
  it("renvoie le compte propriétaire de l'empreinte", async () => {
    const { db, query } = makeFakeDb([{ user_id: USER_ID }]);
    expect(await findUserIdByCalendarToken(db, TOKEN_HASH)).toBe(USER_ID);
    expect(query.mock.lastCall?.[1]).toEqual([TOKEN_HASH]);
    // Bloc 10 : le flux d'un compte coupé répond comme un jeton inconnu.
    expect(query.mock.lastCall?.[0]).toContain(ACTIVE_ACCOUNT_CONDITION);
  });

  it("renvoie null pour une empreinte inconnue", async () => {
    const { db } = makeFakeDb();
    expect(await findUserIdByCalendarToken(db, TOKEN_HASH)).toBeNull();
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([{ user_id: "pas-un-uuid" }]);
    await expect(findUserIdByCalendarToken(db, TOKEN_HASH)).rejects.toThrow();
  });
});
