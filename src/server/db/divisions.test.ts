import { describe, expect, it } from "vitest";
import { findDivisionCup, listDivisions, listFrequentDivisionIds } from "./divisions";
import { makeFakeDb } from "./fake-db";

const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";

describe("listDivisions", () => {
  it("mappe les colonnes vers le type applicatif", async () => {
    const { db } = makeFakeDb([
      { id: DIVISION_ID, division: "Regional", type: "Feminin", level: "U15", cup: false },
    ]);
    expect(await listDivisions(db)).toEqual([
      { id: DIVISION_ID, category: "Regional", type: "Feminin", level: "U15", cup: false },
    ]);
  });

  it("met les coupes après tous les championnats", async () => {
    const { db, query } = makeFakeDb([
      { id: DIVISION_ID, division: "Departemental", type: "Masculin", level: "Seniors", cup: true },
    ]);
    expect(await listDivisions(db)).toEqual([
      { id: DIVISION_ID, category: "Departemental", type: "Masculin", level: "Seniors", cup: true },
    ]);
    expect(query.mock.calls[0]?.[0]).toContain("ORDER BY cup, division, type, level");
  });

  it("refuse une valeur inconnue plutôt que de l'afficher", async () => {
    const { db } = makeFakeDb([
      { id: DIVISION_ID, division: "Mondial", type: "Masculin", level: "1", cup: false },
    ]);
    await expect(listDivisions(db)).rejects.toThrow();
  });
});

describe("listFrequentDivisionIds", () => {
  const USER_ID = "7c1e4b2a-9d3f-4e8a-b6c5-2f1a0d9e8b77";

  it("filtre par propriétaire et passe la limite en paramètre", async () => {
    const { db, query } = makeFakeDb([{ division_id: DIVISION_ID }]);
    expect(await listFrequentDivisionIds(db, USER_ID, 5)).toEqual([DIVISION_ID]);
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain("user_id = $1");
    expect(sql).toContain("deleted_at IS NULL");
    expect(params).toEqual([USER_ID, 5]);
  });

  it("refuse un identifiant mal formé", async () => {
    const { db } = makeFakeDb([{ division_id: "pas-un-uuid" }]);
    await expect(listFrequentDivisionIds(db, USER_ID, 5)).rejects.toThrow();
  });
});

describe("findDivisionCup", () => {
  it("indique si la division est une coupe", async () => {
    const { db, query } = makeFakeDb([{ cup: true }]);
    expect(await findDivisionCup(db, DIVISION_ID)).toEqual({ cup: true });
    expect(query.mock.calls[0]?.[1]).toEqual([DIVISION_ID]);
  });

  it("null si la division n'existe pas", async () => {
    const { db } = makeFakeDb();
    expect(await findDivisionCup(db, DIVISION_ID)).toBeNull();
  });
});
