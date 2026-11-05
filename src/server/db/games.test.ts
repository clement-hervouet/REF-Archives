import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  MAX_GAMES_PER_USER,
  findCompensationForGame,
  findGame,
  insertGameFromCompensation,
  linkCompensationToGame,
  lockCompensationLink,
  lockGame,
  softDeleteGame,
  syncGameFromCompensation,
  updateGameOfficials,
  type OfficialIds,
} from "./games";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const SELF_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e00";
const PERSON_A = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";

const OFFICIALS: OfficialIds = {
  referee1: PERSON_A,
  referee2: SELF_ID,
  referee3: null,
  observer: null,
};

describe("lockCompensationLink", () => {
  it("verrouille l'indemnité de l'utilisateur et renvoie son match lié", async () => {
    const { db, query } = makeFakeDb([{ game_id: null }]);
    expect(
      await lockCompensationLink(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toEqual({ found: true, gameId: null });
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });

  it("signale un match déjà lié", async () => {
    const { db } = makeFakeDb([{ game_id: GAME_ID }]);
    expect(
      await lockCompensationLink(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toEqual({ found: true, gameId: GAME_ID });
  });

  it("signale une indemnité introuvable", async () => {
    const { db } = makeFakeDb();
    expect(
      await lockCompensationLink(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toEqual({ found: false });
  });
});

describe("insertGameFromCompensation", () => {
  it("crée le match depuis l'indemnité, officiels dans l'ordre officiel", async () => {
    const { db, query } = makeFakeDb([{ id: GAME_ID }]);
    expect(
      await insertGameFromCompensation(db, {
        userId: USER_ID,
        compensationId: COMPENSATION_ID,
        officials: OFFICIALS,
      }),
    ).toBe(GAME_ID);
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      COMPENSATION_ID,
      PERSON_A,
      SELF_ID,
      null,
      null,
      MAX_GAMES_PER_USER,
    ]);
  });

  it("renvoie null quand la limite est atteinte", async () => {
    const { db } = makeFakeDb([{ id: null }]);
    expect(
      await insertGameFromCompensation(db, {
        userId: USER_ID,
        compensationId: COMPENSATION_ID,
        officials: OFFICIALS,
      }),
    ).toBeNull();
  });
});

describe("linkCompensationToGame", () => {
  it("lie l'indemnité de l'utilisateur au match", async () => {
    const { db, query } = makeFakeDb();
    await linkCompensationToGame(db, {
      userId: USER_ID,
      compensationId: COMPENSATION_ID,
      gameId: GAME_ID,
    });
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID, GAME_ID]);
  });
});

describe("lockGame", () => {
  it("vrai pour un match actif de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([{ id: GAME_ID }]);
    expect(await lockGame(db, { gameId: GAME_ID, userId: USER_ID })).toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("faux sinon", async () => {
    const { db } = makeFakeDb();
    expect(await lockGame(db, { gameId: GAME_ID, userId: USER_ID })).toBe(false);
  });
});

describe("updateGameOfficials", () => {
  it("remplace les quatre places", async () => {
    const { db, query } = makeFakeDb();
    await updateGameOfficials(db, { gameId: GAME_ID, userId: USER_ID, officials: OFFICIALS });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID, PERSON_A, SELF_ID, null, null]);
  });
});

describe("syncGameFromCompensation", () => {
  it("recopie les informations de l'indemnité vers le match lié", async () => {
    const { db, query } = makeFakeDb();
    await syncGameFromCompensation(db, { compensationId: COMPENSATION_ID, userId: USER_ID });
    expect(query.mock.calls[0]?.[0]).toContain("g.id = c.game_id");
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });
});

describe("softDeleteGame", () => {
  it("supprime le match et détache l'indemnité dans la même requête", async () => {
    const { db, query } = makeFakeDb([{ id: GAME_ID }]);
    expect(await softDeleteGame(db, { gameId: GAME_ID, userId: USER_ID })).toBe(true);
    expect(query.mock.calls[0]?.[0]).toContain("SET game_id = NULL");
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("faux si introuvable", async () => {
    const { db } = makeFakeDb();
    expect(await softDeleteGame(db, { gameId: GAME_ID, userId: USER_ID })).toBe(false);
  });
});

describe("findGame", () => {
  const self = {
    id: SELF_ID,
    is_self: true,
    firstname: null,
    lastname: null,
    has_account: false,
  };
  const colleague = {
    id: PERSON_A,
    is_self: false,
    firstname: "Alex",
    lastname: "Martin",
    has_account: true,
  };

  it("renvoie le match avec ses officiels et son indemnité liée", async () => {
    const startsAt = new Date("2026-11-14T18:00:00Z");
    const { db, query } = makeFakeDb([
      {
        id: GAME_ID,
        starts_at: startsAt,
        division: "Regional",
        type: "Masculin",
        level: "1",
        team1_name: "Club Alpha",
        team2_name: "Club Beta",
        street: "Avenue du Sport",
        number: "2",
        postal_code: "62400",
        city: "Béthune",
        compensation_id: COMPENSATION_ID,
        referee1: colleague,
        referee2: self,
        referee3: null,
        observer: null,
      },
    ]);
    expect(await findGame(db, { gameId: GAME_ID, userId: USER_ID })).toEqual({
      id: GAME_ID,
      startsAt,
      division: { category: "Regional", type: "Masculin", level: "1" },
      team1Name: "Club Alpha",
      team2Name: "Club Beta",
      address: { street: "Avenue du Sport", number: "2", postalCode: "62400", city: "Béthune" },
      compensationId: COMPENSATION_ID,
      officials: {
        referee1: {
          id: PERSON_A,
          isSelf: false,
          firstname: "Alex",
          lastname: "Martin",
          hasAccount: true,
        },
        referee2: { id: SELF_ID, isSelf: true, firstname: null, lastname: null, hasAccount: false },
        referee3: null,
        observer: null,
      },
    });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("null si introuvable, supprimé ou d'un autre utilisateur", async () => {
    const { db } = makeFakeDb();
    expect(await findGame(db, { gameId: GAME_ID, userId: USER_ID })).toBeNull();
  });
});

describe("findCompensationForGame", () => {
  it("renvoie l'indemnité de l'utilisateur et son match lié", async () => {
    const startsAt = new Date("2026-11-14T18:00:00Z");
    const { db, query } = makeFakeDb([
      {
        id: COMPENSATION_ID,
        starts_at: startsAt,
        game_id: null,
        team1_name: "Club Alpha",
        team2_name: "Club Beta",
      },
    ]);
    expect(
      await findCompensationForGame(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toEqual({
      id: COMPENSATION_ID,
      startsAt,
      gameId: null,
      team1Name: "Club Alpha",
      team2Name: "Club Beta",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });

  it("null si introuvable", async () => {
    const { db } = makeFakeDb();
    expect(
      await findCompensationForGame(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toBeNull();
  });
});
