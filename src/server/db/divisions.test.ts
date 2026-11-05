import { describe, expect, it } from "vitest";
import { listDivisions } from "./divisions";
import { makeFakeDb } from "./fake-db";

const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";

describe("listDivisions", () => {
  it("mappe les colonnes vers le type applicatif", async () => {
    const { db } = makeFakeDb([
      { id: DIVISION_ID, division: "Regional", type: "Feminin", level: "U15" },
    ]);
    expect(await listDivisions(db)).toEqual([
      { id: DIVISION_ID, category: "Regional", type: "Feminin", level: "U15" },
    ]);
  });

  it("refuse une valeur inconnue plutôt que de l'afficher", async () => {
    const { db } = makeFakeDb([
      { id: DIVISION_ID, division: "Mondial", type: "Masculin", level: "1" },
    ]);
    await expect(listDivisions(db)).rejects.toThrow();
  });
});
