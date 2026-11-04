import { describe, expect, it } from "vitest";
import { listAddresses, listClubs } from "./clubs";
import { makeFakeDb } from "./fake-db";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const CLUB_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const ADDRESS_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";

describe("listClubs", () => {
  it("renvoie les clubs de l'utilisateur avec leur adresse", async () => {
    const { db, query } = makeFakeDb([
      {
        id: CLUB_ID,
        name: "BC Béthune",
        address_id: ADDRESS_ID,
        street: "Avenue du Sport",
        number: null,
        postal_code: "62400",
        city: "Béthune",
      },
    ]);
    expect(await listClubs(db, USER_ID)).toEqual([
      {
        id: CLUB_ID,
        name: "BC Béthune",
        address: {
          id: ADDRESS_ID,
          street: "Avenue du Sport",
          number: null,
          postalCode: "62400",
          city: "Béthune",
        },
      },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID]);
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([{ id: "1", name: "X" }]);
    await expect(listClubs(db, USER_ID)).rejects.toThrow();
  });
});

describe("listAddresses", () => {
  it("renvoie les adresses de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([
      { id: ADDRESS_ID, street: "Rue Gambetta", number: "5", postal_code: "62000", city: "Arras" },
    ]);
    expect(await listAddresses(db, USER_ID)).toEqual([
      { id: ADDRESS_ID, street: "Rue Gambetta", number: "5", postalCode: "62000", city: "Arras" },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID]);
  });
});
