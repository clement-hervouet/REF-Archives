import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  handleCreateClub,
  handleDeleteClub,
  handleUpdateClub,
  readClubFormData,
} from "./manage-clubs";
import type { ClubDeps } from "./manage-clubs";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const CLUB_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const ADDRESS_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";

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
  } satisfies ClubDeps;
  return { deps, query };
}

const FULL = {
  name: " BC Béthune ",
  street: "Avenue du Sport",
  number: "2",
  postalCode: "62400",
  city: "Béthune",
  country: "",
};

describe("readClubFormData", () => {
  it("remplace un champ facultatif absent par une saisie vide", () => {
    expect(readClubFormData(formData({ name: "BC Béthune", postalCode: "62400" }))).toEqual({
      name: "BC Béthune",
      street: "",
      number: "",
      postalCode: "62400",
      city: "",
      country: "",
    });
  });
});

describe("handleCreateClub", () => {
  it("crée un club avec son nom et son code postal seulement", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(
      await handleCreateClub(deps, USER_ID, formData({ name: "BC Béthune", postalCode: "62400" })),
    ).toEqual({ status: "created" });
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      "BC Béthune",
      null,
      null,
      "62400",
      null,
      null,
      1000,
    ]);
  });

  it("crée un club avec son adresse complète", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(await handleCreateClub(deps, USER_ID, formData(FULL))).toEqual({ status: "created" });
    expect(query.mock.calls[0]?.[1]?.slice(1, 7)).toEqual([
      "BC Béthune",
      "Avenue du Sport",
      "2",
      "62400",
      "Béthune",
      null,
    ]);
  });

  it("refuse un club sans nom ni code postal, sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateClub(deps, USER_ID, formData({ ...FULL, name: " ", postalCode: "" })),
    ).toEqual({ status: "invalid", fields: ["name", "postalCode"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse une rue sur plusieurs lignes", async () => {
    const { deps } = setup();
    expect(
      await handleCreateClub(deps, USER_ID, formData({ ...FULL, street: "Rue\ndu Sport" })),
    ).toEqual({ status: "invalid", fields: ["street"] });
  });

  it("signale la limite de clubs", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: null }] });
    expect(await handleCreateClub(deps, USER_ID, formData(FULL))).toEqual({
      status: "limit_reached",
    });
  });
});

describe("handleUpdateClub", () => {
  it("modifie le nom et l'adresse du club de l'utilisateur", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: ADDRESS_ID }] });
    expect(await handleUpdateClub(deps, USER_ID, formData({ ...FULL, clubId: CLUB_ID }))).toEqual({
      status: "updated",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      CLUB_ID,
      USER_ID,
      "BC Béthune",
      "Avenue du Sport",
      "2",
      "62400",
      "Béthune",
      null,
    ]);
  });

  it("répond introuvable pour un club d'un autre compte", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    expect(await handleUpdateClub(deps, USER_ID, formData({ ...FULL, clubId: CLUB_ID }))).toEqual({
      status: "not_found",
    });
  });

  it("refuse un identifiant mal formé sans requête", async () => {
    const { deps, query } = setup();
    expect(await handleUpdateClub(deps, USER_ID, formData({ ...FULL, clubId: "1" }))).toEqual({
      status: "not_found",
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("handleDeleteClub", () => {
  it("supprime le club puis son adresse si elle n'est plus utilisée", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await handleDeleteClub(deps, USER_ID, formData({ clubId: CLUB_ID }))).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([CLUB_ID, USER_ID]);
    expect(query.mock.calls[1]?.[0]).toContain("DELETE FROM address");
    expect(query.mock.calls[1]?.[1]).toEqual([ADDRESS_ID, USER_ID]);
  });

  it("refuse un club cité par une indemnité ou un match", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(await handleDeleteClub(deps, USER_ID, formData({ clubId: CLUB_ID }))).toEqual({
      status: "in_use",
    });
  });

  it("répond introuvable pour un club inconnu", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    expect(await handleDeleteClub(deps, USER_ID, formData({ clubId: CLUB_ID }))).toEqual({
      status: "not_found",
    });
  });
});
