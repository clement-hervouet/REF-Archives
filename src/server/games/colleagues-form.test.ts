import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  handleCreateColleague,
  handleDeleteColleague,
  handleUpdateColleague,
} from "./colleagues-form";
import { handleDeleteGame } from "./game-form";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const PERSON_A = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies GameDeps;
  return { deps, query };
}

describe("handleCreateColleague", () => {
  it("crée le collègue saisi", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: PERSON_A }] });
    expect(
      await handleCreateColleague(
        deps,
        USER_ID,
        formData({ lastname: " Martin ", firstname: "", hasAccount: "on" }),
      ),
    ).toEqual({ status: "created" });
    expect(query.mock.calls[0]?.[1]?.slice(0, 4)).toEqual([USER_ID, null, "Martin", true]);
  });

  it("refuse un nom vide sans requête", async () => {
    const { deps, query } = setup();
    expect(await handleCreateColleague(deps, USER_ID, formData({ lastname: " " }))).toEqual({
      status: "invalid",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("signale la limite atteinte", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: null }] });
    expect(await handleCreateColleague(deps, USER_ID, formData({ lastname: "Martin" }))).toEqual({
      status: "limit_reached",
    });
  });
});

describe("handleUpdateColleague", () => {
  it("modifie le collègue désigné", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: PERSON_A }] });
    expect(
      await handleUpdateColleague(
        deps,
        USER_ID,
        formData({ personId: PERSON_A, lastname: "Martin", firstname: "Alex" }),
      ),
    ).toEqual({ status: "updated" });
    expect(query.mock.calls[0]?.[1]).toEqual([PERSON_A, USER_ID, "Alex", "Martin", false]);
  });

  it("signale un collègue introuvable ou un identifiant mal formé", async () => {
    const { deps } = setup();
    expect(
      await handleUpdateColleague(deps, USER_ID, formData({ personId: PERSON_A, lastname: "M" })),
    ).toEqual({ status: "not_found" });
    expect(
      await handleUpdateColleague(deps, USER_ID, formData({ personId: "x", lastname: "M" })),
    ).toEqual({ status: "not_found" });
  });
});

describe("handleDeleteColleague", () => {
  it("transmet le résultat de la suppression", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: PERSON_A }] });
    expect(await handleDeleteColleague(deps, USER_ID, formData({ personId: PERSON_A }))).toEqual({
      status: "in_use",
    });
  });
});

describe("handleDeleteGame", () => {
  it("supprime le match désigné", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: GAME_ID }] });
    expect(await handleDeleteGame(deps, USER_ID, formData({ gameId: GAME_ID }))).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("signale un match introuvable ou un identifiant mal formé", async () => {
    const { deps } = setup();
    expect(await handleDeleteGame(deps, USER_ID, formData({ gameId: GAME_ID }))).toEqual({
      status: "not_found",
    });
    expect(await handleDeleteGame(deps, USER_ID, formData({ gameId: "x" }))).toEqual({
      status: "not_found",
    });
  });
});
