import { describe, expect, it } from "vitest";
import { preparationFormSchema } from "@/lib/schemas/preparations";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { prepareFromCompensation, saveGamePreparation } from "./manage-preparation";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";
const SELF_ID = "8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d01";

const TEAM = {
  rank: "",
  wins: "",
  losses: "",
  players: "",
  coaches: "",
  alreadyRefereed: false,
};

const PREPARATION = preparationFormSchema.parse({
  teamCount: "10",
  team1: { ...TEAM, rank: "2", wins: "6", losses: "1", alreadyRefereed: true },
  team2: { ...TEAM, coaches: "Coach qui conteste beaucoup." },
  crew: { placement: "Rester large", communication: "", management: "", table: "", contact: "" },
  observed: true,
});

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies GameDeps;
  return { deps, query };
}

describe("saveGamePreparation", () => {
  it("verrouille le match puis écrit la préparation", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ plateau: false }] });
    expect(await saveGamePreparation(deps, USER_ID, GAME_ID, PREPARATION)).toEqual({
      status: "saved",
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
    expect(query.mock.calls[1]?.[1]).toEqual([
      USER_ID,
      GAME_ID,
      10,
      2,
      6,
      1,
      null,
      null,
      true,
      null,
      null,
      null,
      null,
      "Coach qui conteste beaucoup.",
      false,
      "Rester large",
      null,
      null,
      null,
      null,
      true,
    ]);
  });

  it("refuse un match introuvable, supprimé ou d'un autre utilisateur", async () => {
    const { deps, query } = setup();
    expect(await saveGamePreparation(deps, USER_ID, GAME_ID, PREPARATION)).toEqual({
      status: "not_found",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse un plateau sans rien écrire", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ plateau: true }] });
    expect(await saveGamePreparation(deps, USER_ID, GAME_ID, PREPARATION)).toEqual({
      status: "plateau",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

const COMPENSATION_ROW = {
  id: COMPENSATION_ID,
  starts_at: new Date("2026-11-21T19:00:00Z"),
  game_id: null,
  team1_name: "BC BÉTHUNE",
  team2_name: "ES LENS",
};

describe("prepareFromCompensation", () => {
  it("renvoie le match déjà lié sans rien créer", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ ...COMPENSATION_ROW, game_id: GAME_ID }] });
    expect(await prepareFromCompensation(deps, USER_ID, COMPENSATION_ID)).toEqual({
      status: "ready",
      gameId: GAME_ID,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse un plateau sans créer de match", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ ...COMPENSATION_ROW, team2_name: null }] });
    expect(await prepareFromCompensation(deps, USER_ID, COMPENSATION_ID)).toEqual({
      status: "plateau",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse une indemnité introuvable", async () => {
    const { deps } = setup();
    expect(await prepareFromCompensation(deps, USER_ID, COMPENSATION_ID)).toEqual({
      status: "not_found",
    });
  });

  it("crée le match avec l'utilisateur arbitre 1 puis le lie à l'indemnité", async () => {
    const { deps, query } = setup();
    // Réponses selon la requête : lecture de l'indemnité, verrou (pas encore de match),
    // fiche « moi », match créé ; la liaison ne renvoie rien.
    query.mockImplementation((sql: string) => {
      if (sql.includes("club1.name AS team1_name")) {
        return Promise.resolve({ rows: [COMPENSATION_ROW] });
      }
      if (sql.includes("FOR UPDATE")) {
        return Promise.resolve({ rows: [{ game_id: null }] });
      }
      if (sql.includes("INSERT INTO game")) {
        return Promise.resolve({ rows: [{ id: GAME_ID }] });
      }
      if (sql.includes("person")) {
        return Promise.resolve({ rows: [{ id: SELF_ID }] });
      }
      return Promise.resolve({ rows: [] });
    });
    expect(await prepareFromCompensation(deps, USER_ID, COMPENSATION_ID)).toEqual({
      status: "ready",
      gameId: GAME_ID,
    });
    const officials = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO game"))?.[1];
    expect(officials).toEqual(expect.arrayContaining([SELF_ID]));
  });
});
