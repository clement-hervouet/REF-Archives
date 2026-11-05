import { describe, expect, it } from "vitest";
import { officialsSchema, type OfficialsInput } from "@/lib/schemas/officials";
import { makeFakeDb } from "../db/fake-db";
import { MAX_GAMES_PER_USER } from "../db/games";
import { MAX_COLLEAGUES_PER_USER } from "../db/persons";
import type { Queryable } from "../db/users";
import { createGameFromCompensation, updateOfficials } from "./manage-game";
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
