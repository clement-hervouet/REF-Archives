import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  MAX_COLLEAGUES_PER_USER,
  deleteColleague,
  ensureSelfPerson,
  findOwnedColleagueIds,
  insertColleague,
  listColleagues,
  toPersonSummary,
  updateColleague,
} from "./persons";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const SELF_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e00";
const PERSON_A = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";
const PERSON_B = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e02";

const COLLEAGUE = { firstname: null, lastname: "Martin", hasAccount: true };

describe("ensureSelfPerson", () => {
  it("crée la fiche si besoin (sans doublon) puis renvoie son identifiant", async () => {
    const { db, query } = makeFakeDb();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: SELF_ID }] });
    expect(await ensureSelfPerson(db, USER_ID)).toBe(SELF_ID);
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (user_id) WHERE is_self DO NOTHING");
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID]);
    expect(query.mock.calls[1]?.[1]).toEqual([USER_ID]);
  });
});

describe("listColleagues", () => {
  it("renvoie les collègues de l'utilisateur, sans la fiche « moi »", async () => {
    const { db, query } = makeFakeDb([
      { id: PERSON_A, firstname: null, lastname: "Durand", has_account: false },
      { id: PERSON_B, firstname: "Alex", lastname: "Martin", has_account: true },
    ]);
    expect(await listColleagues(db, USER_ID)).toEqual([
      { id: PERSON_A, firstname: null, lastname: "Durand", hasAccount: false },
      { id: PERSON_B, firstname: "Alex", lastname: "Martin", hasAccount: true },
    ]);
    expect(query.mock.calls[0]?.[0]).toContain("NOT is_self");
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID]);
  });
});

describe("findOwnedColleagueIds", () => {
  it("ne garde que les collègues de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([{ id: PERSON_A }]);
    const ids = await findOwnedColleagueIds(db, {
      userId: USER_ID,
      personIds: [PERSON_A, PERSON_B],
    });
    expect([...ids]).toEqual([PERSON_A]);
    expect(query.mock.calls[0]?.[0]).toContain("NOT is_self");
    expect(query.mock.calls[0]?.[1]).toEqual([[PERSON_A, PERSON_B], USER_ID]);
  });

  it("ne fait aucune requête sans identifiant", async () => {
    const { db, query } = makeFakeDb();
    expect((await findOwnedColleagueIds(db, { userId: USER_ID, personIds: [] })).size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("insertColleague", () => {
  it("crée le collègue sous la limite", async () => {
    const { db, query } = makeFakeDb([{ id: PERSON_A }]);
    expect(await insertColleague(db, { userId: USER_ID, colleague: COLLEAGUE })).toBe(PERSON_A);
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      null,
      "Martin",
      true,
      MAX_COLLEAGUES_PER_USER,
    ]);
  });

  it("renvoie null quand la limite est atteinte", async () => {
    const { db } = makeFakeDb([{ id: null }]);
    expect(await insertColleague(db, { userId: USER_ID, colleague: COLLEAGUE })).toBeNull();
  });
});

describe("updateColleague", () => {
  it("modifie un collègue de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([{ id: PERSON_A }]);
    expect(
      await updateColleague(db, { userId: USER_ID, personId: PERSON_A, colleague: COLLEAGUE }),
    ).toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain("NOT is_self");
    expect(query.mock.calls[0]?.[1]).toEqual([PERSON_A, USER_ID, null, "Martin", true]);
  });

  it("faux si introuvable", async () => {
    const { db } = makeFakeDb();
    expect(
      await updateColleague(db, { userId: USER_ID, personId: PERSON_A, colleague: COLLEAGUE }),
    ).toBe(false);
  });
});

describe("deleteColleague", () => {
  it("supprime un collègue inutilisé", async () => {
    const { db, query } = makeFakeDb([{ id: PERSON_A }]);
    expect(await deleteColleague(db, { userId: USER_ID, personId: PERSON_A })).toBe("deleted");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([PERSON_A, USER_ID]);
  });

  it("signale un collègue encore cité par un match", async () => {
    const { db, query } = makeFakeDb();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: PERSON_A }] });
    expect(await deleteColleague(db, { userId: USER_ID, personId: PERSON_A })).toBe("in_use");
  });

  it("signale un collègue introuvable", async () => {
    const { db } = makeFakeDb();
    expect(await deleteColleague(db, { userId: USER_ID, personId: PERSON_A })).toBe("not_found");
  });
});

describe("toPersonSummary", () => {
  it("convertit une ligne en résumé", () => {
    expect(
      toPersonSummary({
        id: SELF_ID,
        is_self: true,
        firstname: null,
        lastname: null,
        has_account: false,
      }),
    ).toEqual({ id: SELF_ID, isSelf: true, firstname: null, lastname: null, hasAccount: false });
  });
});
