import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  handleDeletePreparation,
  handlePrepareMatch,
  handleSavePreparation,
  preparationFormValues,
  readPreparationFormData,
} from "./preparation-form";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies GameDeps;
  return { deps, query };
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

describe("readPreparationFormData", () => {
  it("lit les champs des deux équipes, du trio et les cases", () => {
    expect(
      readPreparationFormData(
        form({
          teamCount: "12",
          team1Rank: "3",
          team1AlreadyRefereed: "1",
          team2Coaches: "Calme",
          contact: "Tolérance haute",
          observed: "1",
        }),
      ),
    ).toEqual({
      teamCount: "12",
      team1: {
        rank: "3",
        wins: "",
        losses: "",
        players: "",
        coaches: "",
        alreadyRefereed: true,
      },
      team2: {
        rank: "",
        wins: "",
        losses: "",
        players: "",
        coaches: "Calme",
        alreadyRefereed: false,
      },
      crew: {
        placement: "",
        communication: "",
        management: "",
        table: "",
        contact: "Tolérance haute",
      },
      observed: true,
    });
  });
});

describe("handleSavePreparation", () => {
  it("enregistre une préparation valide", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ plateau: false }] });
    expect(
      await handleSavePreparation(deps, USER_ID, form({ gameId: GAME_ID, team1Wins: "4" })),
    ).toEqual({ status: "saved" });
  });

  it("signale une préparation vide et les champs invalides sans écrire", async () => {
    const { deps, query } = setup();
    expect(
      await handleSavePreparation(
        deps,
        USER_ID,
        form({ gameId: GAME_ID, observed: "1", team1AlreadyRefereed: "1" }),
      ),
    ).toEqual({ status: "invalid", fields: {}, empty: true });
    expect(
      await handleSavePreparation(
        deps,
        USER_ID,
        form({ gameId: GAME_ID, team2Rank: "9", teamCount: "8", team1Wins: "x" }),
      ),
    ).toEqual({
      status: "invalid",
      fields: { team1Wins: "invalid", team2Rank: "rank_above_count" },
      empty: false,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse un identifiant de match invalide", async () => {
    const { deps } = setup();
    expect(await handleSavePreparation(deps, USER_ID, form({ gameId: "abc" }))).toEqual({
      status: "not_found",
    });
  });
});

describe("handleDeletePreparation", () => {
  it("supprime la préparation du match", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: GAME_ID }] });
    expect(await handleDeletePreparation(deps, USER_ID, form({ gameId: GAME_ID }))).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("renvoie « introuvable » sans préparation", async () => {
    const { deps } = setup();
    expect(await handleDeletePreparation(deps, USER_ID, form({ gameId: GAME_ID }))).toEqual({
      status: "not_found",
    });
  });
});

describe("handlePrepareMatch", () => {
  it("traite un plateau comme introuvable", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({
      rows: [
        {
          id: COMPENSATION_ID,
          starts_at: new Date(),
          game_id: null,
          team1_name: "BC BÉTHUNE",
          team2_name: null,
        },
      ],
    });
    expect(
      await handlePrepareMatch(deps, USER_ID, form({ compensationId: COMPENSATION_ID })),
    ).toEqual({ status: "not_found" });
  });

  it("refuse un identifiant invalide", async () => {
    const { deps, query } = setup();
    expect(await handlePrepareMatch(deps, USER_ID, form({ compensationId: "1" }))).toEqual({
      status: "not_found",
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("preparationFormValues", () => {
  it("pré-coche les cases d'une préparation pas encore enregistrée", () => {
    const values = preparationFormValues(null, {
      alreadyRefereed: { team1: true, team2: false },
      hasObserver: true,
    });
    expect(values.team1AlreadyRefereed).toBe("1");
    expect(values.team2AlreadyRefereed).toBe("");
    expect(values.observed).toBe("1");
    expect(values.team1Rank).toBe("");
    expect(values.teamCount).toBe("");
    expect(values.placement).toBe("");
  });

  it("reprend la préparation enregistrée, dont les cases priment sur le calcul", () => {
    const team = {
      rank: 3,
      wins: 7,
      losses: 2,
      players: "Le 8",
      coaches: null,
      alreadyRefereed: false,
    };
    const values = preparationFormValues(
      {
        teamCount: 12,
        team1: team,
        team2: { ...team, rank: null },
        crew: {
          placement: "Large",
          communication: null,
          management: null,
          table: null,
          contact: null,
        },
        observed: false,
      },
      { alreadyRefereed: { team1: true, team2: true }, hasObserver: true },
    );
    expect(values).toMatchObject({
      teamCount: "12",
      team1Rank: "3",
      team1Players: "Le 8",
      team1Coaches: "",
      team1AlreadyRefereed: "",
      team2Rank: "",
      placement: "Large",
      observed: "",
    });
  });
});
