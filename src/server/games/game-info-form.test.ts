import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  gameInfoFormValues,
  handleCreateStandaloneGame,
  handleUpdateGameInfo,
} from "./game-info-form";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const CLUB_A = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const CLUB_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02";
const ADDRESS_A = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";
const ADDRESS_B = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b02";

const MATCH_FIELDS = {
  date: "2026-11-14",
  time: "19:00",
  divisionId: DIVISION_ID,
  team1Club: CLUB_A,
  team2Club: CLUB_B,
};

const SELF_ONLY = {
  referee1Person: "self",
  referee2Person: "none",
  referee3Person: "none",
  observerPerson: "none",
};

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

describe("handleCreateStandaloneGame", () => {
  it("signale ensemble les erreurs d'informations et d'officiels, sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateStandaloneGame(
        deps,
        USER_ID,
        formData({
          ...MATCH_FIELDS,
          team2Club: CLUB_A,
          date: "",
          ...SELF_ONLY,
          observerPerson: "self",
        }),
      ),
    ).toEqual({
      status: "invalid",
      fields: ["date", "team2"],
      officials: { observer: "self_twice" },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("transmet un formulaire valide au service", async () => {
    const { deps } = setup();
    // Niveau introuvable (base vide) : la validation est passée, le service a répondu.
    expect(
      await handleCreateStandaloneGame(deps, USER_ID, formData({ ...MATCH_FIELDS, ...SELF_ONLY })),
    ).toEqual({ status: "not_found", field: "divisionId" });
  });
});

describe("handleUpdateGameInfo", () => {
  it("refuse un identifiant de match mal formé", async () => {
    const { deps, query } = setup();
    expect(await handleUpdateGameInfo(deps, USER_ID, formData(MATCH_FIELDS))).toEqual({
      status: "not_found",
      field: "game",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("signale les champs invalides", async () => {
    const { deps } = setup();
    expect(
      await handleUpdateGameInfo(
        deps,
        USER_ID,
        formData({ ...MATCH_FIELDS, gameId: GAME_ID, time: "25:00" }),
      ),
    ).toEqual({ status: "invalid", fields: ["time"], officials: {} });
  });
});

describe("gameInfoFormValues", () => {
  const game = {
    id: GAME_ID,
    startsAt: new Date("2026-11-14T18:00:00Z"),
    divisionId: DIVISION_ID,
    team1ClubId: CLUB_A,
    team2ClubId: CLUB_B,
    addressId: ADDRESS_A,
    team1AddressId: ADDRESS_A,
    compensationId: null,
  };

  it("préremplit date et heure de Paris, niveau et clubs", () => {
    expect(gameInfoFormValues(game)).toEqual({ ...MATCH_FIELDS });
  });

  it("coche l'exception quand l'adresse diffère de celle du club de l'équipe 1", () => {
    expect(gameInfoFormValues({ ...game, addressId: ADDRESS_B })).toEqual({
      ...MATCH_FIELDS,
      venueException: "on",
      venueAddress: ADDRESS_B,
    });
  });
});
