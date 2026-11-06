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
const CLUB_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";

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
    expect(query.mock.calls[0]?.[1]).toEqual([PERSON_A, USER_ID, "Alex", "Martin", false, null]);
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

describe("club du collègue", () => {
  it("vérifie le club de l'utilisateur avant de créer", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] }).mockResolvedValueOnce({
      rows: [{ id: PERSON_A }],
    });
    expect(
      await handleCreateColleague(deps, USER_ID, formData({ lastname: "Martin", clubId: CLUB_ID })),
    ).toEqual({ status: "created" });
    expect(query.mock.calls[0]?.[0]).toContain("FROM club");
    expect(query.mock.calls[0]?.[1]).toEqual([CLUB_ID, USER_ID]);
    expect(query.mock.calls[1]?.[1]?.[5]).toBe(CLUB_ID);
  });

  it("refuse le club d'un autre compte sans rien écrire", async () => {
    const { deps, query } = setup();
    expect(
      await handleUpdateColleague(
        deps,
        USER_ID,
        formData({ personId: PERSON_A, lastname: "Martin", clubId: CLUB_ID }),
      ),
    ).toEqual({ status: "club_not_found" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse un identifiant de club mal formé sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateColleague(deps, USER_ID, formData({ lastname: "Martin", clubId: "x" })),
    ).toEqual({ status: "club_not_found" });
    expect(query).not.toHaveBeenCalled();
  });

  it("vide = aucun club, sans vérification", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: PERSON_A }] });
    expect(
      await handleUpdateColleague(
        deps,
        USER_ID,
        formData({ personId: PERSON_A, lastname: "Martin", clubId: "" }),
      ),
    ).toEqual({ status: "updated" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]?.[5]).toBeNull();
  });
});

describe("nouveau club depuis un collègue", () => {
  const NEW_CLUB = {
    lastname: "Martin",
    clubId: "new",
    clubName: " BC Rennes ",
    clubStreet: "Rue du Sport",
    clubNumber: "",
    clubPostalCode: "35000",
    clubCity: "Rennes",
    clubCountry: "",
  };
  const ADDRESS_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01";

  it("crée l'adresse, le club puis le collègue rattaché", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: ADDRESS_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: PERSON_A }] });
    expect(await handleCreateColleague(deps, USER_ID, formData(NEW_CLUB))).toEqual({
      status: "created",
    });
    expect(query.mock.calls[0]?.[0]).toContain("INSERT INTO address");
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      "Rue du Sport",
      null,
      "35000",
      "Rennes",
      null,
    ]);
    expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO club");
    expect(query.mock.calls[1]?.[1]?.slice(0, 3)).toEqual([USER_ID, ADDRESS_ID, "BC Rennes"]);
    expect(query.mock.calls[2]?.[1]?.[5]).toBe(CLUB_ID);
  });

  it("signale les champs invalides du club sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateColleague(
        deps,
        USER_ID,
        formData({ ...NEW_CLUB, clubName: "", clubPostalCode: "@@" }),
      ),
    ).toEqual({ status: "club_invalid", fields: ["name", "postalCode"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("limite de clubs : refus, rien n'est créé (transaction annulée)", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: ADDRESS_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: null }] });
    expect(await handleCreateColleague(deps, USER_ID, formData(NEW_CLUB))).toEqual({
      status: "club_limit",
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("limite de collègues après le club : refus (le club est annulé avec)", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: ADDRESS_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: null }] });
    expect(await handleCreateColleague(deps, USER_ID, formData(NEW_CLUB))).toEqual({
      status: "limit_reached",
    });
  });

  it("modification avec nouveau club, collègue introuvable : refus", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: ADDRESS_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await handleUpdateColleague(deps, USER_ID, formData({ ...NEW_CLUB, personId: PERSON_A })),
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
