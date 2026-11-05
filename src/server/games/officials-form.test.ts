import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  DEFAULT_OFFICIALS_VALUES,
  handleCreateGame,
  handleUpdateOfficials,
  officialsFormValues,
  readOfficialsFormData,
} from "./officials-form";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const SELF_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e00";
const PERSON_A = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

const SELF_ONLY = {
  referee1Person: "self",
  referee2Person: "none",
  referee3Person: "none",
  observerPerson: "none",
};

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies GameDeps;
  return { deps, query };
}

describe("readOfficialsFormData", () => {
  it("reconstruit chaque place", () => {
    expect(
      readOfficialsFormData(
        formData({
          referee1Person: PERSON_A,
          referee2Person: "self",
          referee3Person: "none",
          observerPerson: "new",
          observerLastname: "Durand",
          observerHasAccount: "on",
        }),
      ),
    ).toEqual({
      referee1: { kind: "existing", personId: PERSON_A },
      referee2: { kind: "self" },
      referee3: { kind: "none" },
      observer: {
        kind: "new",
        colleague: { firstname: "", lastname: "Durand", hasAccount: true },
      },
    });
  });
});

describe("handleCreateGame", () => {
  it("crée le match d'une composition valide", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ game_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: SELF_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: GAME_ID }] });
    expect(
      await handleCreateGame(
        deps,
        USER_ID,
        formData({ ...SELF_ONLY, compensationId: COMPENSATION_ID }),
      ),
    ).toEqual({ status: "created", gameId: GAME_ID });
  });

  it("refuse un identifiant d'indemnité mal formé sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateGame(deps, USER_ID, formData({ ...SELF_ONLY, compensationId: "42" })),
    ).toEqual({ status: "not_found", field: "compensation" });
    expect(query).not.toHaveBeenCalled();
  });

  it("signale les erreurs place par place, sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateGame(
        deps,
        USER_ID,
        formData({
          compensationId: COMPENSATION_ID,
          referee1Person: "self",
          referee2Person: "new",
          referee2Lastname: "",
          referee3Person: "pas-un-uuid",
          observerPerson: "self",
        }),
      ),
    ).toEqual({
      status: "invalid",
      errors: { referee2: "invalid_name", referee3: "invalid_choice", observer: "self_twice" },
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("handleUpdateOfficials", () => {
  it("refuse un identifiant de match mal formé", async () => {
    const { deps } = setup();
    expect(await handleUpdateOfficials(deps, USER_ID, formData(SELF_ONLY))).toEqual({
      status: "not_found",
      field: "game",
    });
  });

  it("transmet le refus du service", async () => {
    const { deps } = setup();
    expect(
      await handleUpdateOfficials(deps, USER_ID, formData({ ...SELF_ONLY, gameId: GAME_ID })),
    ).toEqual({ status: "not_found", field: "game" });
  });
});

describe("officialsFormValues", () => {
  it("met « self », l'identifiant du collègue ou « none » à chaque place", () => {
    expect(
      officialsFormValues({
        referee1: {
          id: PERSON_A,
          isSelf: false,
          firstname: null,
          lastname: "M",
          hasAccount: false,
        },
        referee2: { id: SELF_ID, isSelf: true, firstname: null, lastname: null, hasAccount: false },
        referee3: null,
        observer: null,
      }),
    ).toEqual({
      referee1Person: PERSON_A,
      referee2Person: "self",
      referee3Person: "none",
      observerPerson: "none",
    });
  });

  it("propose l'utilisateur arbitre 1 par défaut", () => {
    expect(DEFAULT_OFFICIALS_VALUES).toEqual(SELF_ONLY);
  });
});
