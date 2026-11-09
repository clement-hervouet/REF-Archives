import { describe, expect, it } from "vitest";
import { matchInfoFormSchema } from "@/lib/schemas/compensations";
import { officialsSchema, type OfficialsInput } from "@/lib/schemas/officials";
import { makeFakeDb } from "../db/fake-db";
import { MAX_GAMES_PER_USER } from "../db/games";
import { MAX_COLLEAGUES_PER_USER } from "../db/persons";
import type { Queryable } from "../db/users";
import {
  createGameFromCompensation,
  createStandaloneGame,
  updateGameInfo,
  updateOfficials,
} from "./manage-game";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const OTHER_GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b02";
const SELF_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e00";
const PERSON_A = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";
const PERSON_NEW = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e03";

const NONE = { kind: "none" } as const;

/** Arbitre 1 collègue connu, arbitre 2 « moi », observateur nouveau collègue. */
const FULL_INPUT: OfficialsInput = {
  referee1: { kind: "existing", personId: PERSON_A },
  referee2: { kind: "self" },
  referee3: NONE,
  observer: {
    kind: "new",
    colleague: { firstname: "", lastname: "Durand", hasAccount: false },
  },
};

const SELF_ONLY_INPUT: OfficialsInput = {
  referee1: { kind: "self" },
  referee2: NONE,
  referee3: NONE,
  observer: NONE,
};

function officials(input: OfficialsInput) {
  return officialsSchema.parse(input);
}

function setup() {
  const { db, query } = makeFakeDb();
  let transactions = 0;
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => {
      transactions += 1;
      return action(db);
    },
  } satisfies GameDeps;
  return { deps, query, transactionCount: () => transactions };
}

/** Réponses SQL dans l'ordre des requêtes du service. */
function answer(query: ReturnType<typeof setup>["query"], ...rows: Record<string, unknown>[][]) {
  for (const result of rows) {
    query.mockResolvedValueOnce({ rows: result });
  }
}

describe("createGameFromCompensation", () => {
  it("crée le match depuis l'indemnité, résout les officiels et lie les deux", async () => {
    const { deps, query, transactionCount } = setup();
    answer(
      query,
      [{ game_id: null }],
      [{ id: PERSON_A }],
      [],
      [{ id: SELF_ID }],
      [{ id: PERSON_NEW }],
      [{ id: GAME_ID }],
      [],
    );
    expect(
      await createGameFromCompensation(deps, USER_ID, COMPENSATION_ID, officials(FULL_INPUT)),
    ).toEqual({ status: "created", gameId: GAME_ID });
    expect(transactionCount()).toBe(1);
    expect(query).toHaveBeenCalledTimes(7);
    // Nouveau collègue : prénom vide → NULL.
    expect(query.mock.calls[4]?.[1]).toEqual([
      USER_ID,
      null,
      "Durand",
      false,
      MAX_COLLEAGUES_PER_USER,
      null,
    ]);
    expect(query.mock.calls[5]?.[1]).toEqual([
      USER_ID,
      COMPENSATION_ID,
      PERSON_A,
      SELF_ID,
      null,
      PERSON_NEW,
      MAX_GAMES_PER_USER,
    ]);
    expect(query.mock.calls[6]?.[1]).toEqual([COMPENSATION_ID, USER_ID, GAME_ID]);
  });

  it("ne cherche aucun collègue quand il n'y en a pas", async () => {
    const { deps, query } = setup();
    answer(query, [{ game_id: null }], [], [{ id: SELF_ID }], [{ id: GAME_ID }], []);
    expect(
      await createGameFromCompensation(deps, USER_ID, COMPENSATION_ID, officials(SELF_ONLY_INPUT)),
    ).toEqual({ status: "created", gameId: GAME_ID });
    expect(query).toHaveBeenCalledTimes(5);
  });

  it("refuse une indemnité introuvable, supprimée ou d'un autre utilisateur", async () => {
    const { deps, query } = setup();
    answer(query, []);
    expect(
      await createGameFromCompensation(deps, USER_ID, COMPENSATION_ID, officials(FULL_INPUT)),
    ).toEqual({ status: "not_found", field: "compensation" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("renvoie le match existant d'une indemnité déjà liée", async () => {
    const { deps, query } = setup();
    answer(query, [{ game_id: OTHER_GAME_ID }]);
    expect(
      await createGameFromCompensation(deps, USER_ID, COMPENSATION_ID, officials(FULL_INPUT)),
    ).toEqual({ status: "already_linked", gameId: OTHER_GAME_ID });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse un collègue qui n'est pas à l'utilisateur, sur sa place", async () => {
    const { deps, query } = setup();
    answer(query, [{ game_id: null }], []);
    expect(
      await createGameFromCompensation(deps, USER_ID, COMPENSATION_ID, officials(FULL_INPUT)),
    ).toEqual({ status: "not_found", field: "referee1" });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("refuse quand la limite de collègues est atteinte", async () => {
    const { deps, query } = setup();
    answer(query, [{ game_id: null }], [{ id: PERSON_A }], [], [{ id: SELF_ID }], [{ id: null }]);
    expect(
      await createGameFromCompensation(deps, USER_ID, COMPENSATION_ID, officials(FULL_INPUT)),
    ).toEqual({ status: "limit_reached", resource: "colleague" });
    expect(query).toHaveBeenCalledTimes(5);
  });

  it("refuse quand la limite de matchs est atteinte", async () => {
    const { deps, query } = setup();
    answer(query, [{ game_id: null }], [], [{ id: SELF_ID }], [{ id: null }]);
    expect(
      await createGameFromCompensation(deps, USER_ID, COMPENSATION_ID, officials(SELF_ONLY_INPUT)),
    ).toEqual({ status: "limit_reached", resource: "game" });
    expect(query).toHaveBeenCalledTimes(4);
  });
});

describe("updateOfficials", () => {
  it("verrouille le match et remplace les officiels", async () => {
    const { deps, query } = setup();
    answer(query, [{ id: GAME_ID }], [], [{ id: SELF_ID }], []);
    expect(await updateOfficials(deps, USER_ID, GAME_ID, officials(SELF_ONLY_INPUT))).toEqual({
      status: "updated",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
    expect(query.mock.calls[3]?.[1]).toEqual([GAME_ID, USER_ID, SELF_ID, null, null, null]);
  });

  it("refuse un match introuvable", async () => {
    const { deps, query } = setup();
    answer(query, []);
    expect(await updateOfficials(deps, USER_ID, GAME_ID, officials(SELF_ONLY_INPUT))).toEqual({
      status: "not_found",
      field: "game",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const RATE_OLD = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e61";
const RATE_NEW = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e62";
const CLUB_A = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const CLUB_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02";
const ADDRESS_A = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";
const ADDRESS_B = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b02";
const TEAM_1 = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01";
const TEAM_2 = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02";

const RATES = [
  { id: RATE_OLD, effective_from: "2026-01-01", game_amount_cents: 4500, cents_per_km: "40.00" },
  { id: RATE_NEW, effective_from: "2026-09-01", game_amount_cents: 4800, cents_per_km: "42.50" },
];
const BOTH_CLUBS = [
  { id: CLUB_A, address_id: ADDRESS_A },
  { id: CLUB_B, address_id: ADDRESS_B },
];

function info(date = "2026-11-14") {
  return matchInfoFormSchema.parse({
    date,
    time: "19:00",
    divisionId: DIVISION_ID,
    team1: { kind: "existing", clubId: CLUB_A },
    team2: { kind: "existing", clubId: CLUB_B },
    venue: { kind: "team1" },
  });
}

describe("createStandaloneGame", () => {
  it("crée un match sans indemnité avec ses équipes et ses officiels", async () => {
    const { deps, query, transactionCount } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      BOTH_CLUBS,
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [],
      [{ id: SELF_ID }],
      [{ id: GAME_ID }],
    );
    expect(await createStandaloneGame(deps, USER_ID, info(), officials(SELF_ONLY_INPUT))).toEqual({
      status: "created",
      gameId: GAME_ID,
    });
    expect(transactionCount()).toBe(1);
    expect(query.mock.calls[6]?.[1]).toEqual([
      USER_ID,
      new Date("2026-11-14T18:00:00Z"),
      DIVISION_ID,
      ADDRESS_A,
      TEAM_1,
      TEAM_2,
      SELF_ID,
      null,
      null,
      null,
      MAX_GAMES_PER_USER,
    ]);
  });

  it("refuse un niveau inconnu avant toute écriture", async () => {
    const { deps, query } = setup();
    answer(query, []);
    expect(await createStandaloneGame(deps, USER_ID, info(), officials(SELF_ONLY_INPUT))).toEqual({
      status: "not_found",
      field: "divisionId",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse un club qui n'est pas à l'utilisateur", async () => {
    const { deps, query } = setup();
    answer(query, [{ id: DIVISION_ID }], [{ id: CLUB_A, address_id: ADDRESS_A }]);
    expect(await createStandaloneGame(deps, USER_ID, info(), officials(SELF_ONLY_INPUT))).toEqual({
      status: "not_found",
      field: "team2",
    });
  });
});

describe("updateGameInfo", () => {
  it("met à jour le match et l'indemnité liée avec la ligne en vigueur à la nouvelle date", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: COMPENSATION_ID, scale_id: SCALE_ID }],
      [{ id: GAME_ID }],
      [{ id: DIVISION_ID }],
      RATES,
      BOTH_CLUBS,
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [],
      [],
    );
    // Match déplacé en août : la ligne du 01/01 s'applique.
    expect(await updateGameInfo(deps, USER_ID, GAME_ID, info("2026-08-15"))).toEqual({
      status: "updated",
    });
    expect(query).toHaveBeenCalledTimes(9);
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE OF c");
    expect(query.mock.calls[3]?.[1]).toEqual([SCALE_ID, USER_ID]);
    expect(query.mock.calls[7]?.[1]).toEqual([
      GAME_ID,
      USER_ID,
      new Date("2026-08-15T17:00:00Z"),
      DIVISION_ID,
      ADDRESS_A,
      TEAM_1,
      TEAM_2,
    ]);
    expect(query.mock.calls[8]?.[1]).toEqual([
      COMPENSATION_ID,
      USER_ID,
      new Date("2026-08-15T17:00:00Z"),
      DIVISION_ID,
      ADDRESS_A,
      TEAM_1,
      TEAM_2,
      RATE_OLD,
    ]);
  });

  it("met à jour un match sans indemnité sans toucher aux barèmes", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [],
      [{ id: GAME_ID }],
      [{ id: DIVISION_ID }],
      BOTH_CLUBS,
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [],
    );
    expect(await updateGameInfo(deps, USER_ID, GAME_ID, info())).toEqual({ status: "updated" });
    expect(query).toHaveBeenCalledTimes(7);
  });

  it("refuse quand le barème de l'indemnité n'a pas de ligne à la nouvelle date", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: COMPENSATION_ID, scale_id: SCALE_ID }],
      [{ id: GAME_ID }],
      [{ id: DIVISION_ID }],
      RATES,
    );
    expect(await updateGameInfo(deps, USER_ID, GAME_ID, info("2025-12-31"))).toEqual({
      status: "no_rate_at_date",
    });
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("refuse quand le barème de l'indemnité a été supprimé", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: COMPENSATION_ID, scale_id: SCALE_ID }],
      [{ id: GAME_ID }],
      [{ id: DIVISION_ID }],
      [],
    );
    expect(await updateGameInfo(deps, USER_ID, GAME_ID, info())).toEqual({
      status: "no_rate_at_date",
    });
  });

  it("refuse un match introuvable", async () => {
    const { deps, query } = setup();
    answer(query, [], []);
    expect(await updateGameInfo(deps, USER_ID, GAME_ID, info())).toEqual({
      status: "not_found",
      field: "game",
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
