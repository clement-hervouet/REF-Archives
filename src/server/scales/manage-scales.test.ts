import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  handleAddRate,
  handleCreateScale,
  handleDeleteRate,
  handleDeleteScale,
  handleRenameScale,
  handleSetLevelDefault,
} from "./manage-scales";
import type { ScaleDeps } from "./manage-scales";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const RATE_ID = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e63";
const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const ME = { kind: "user", userId: USER_ID } as const;

function setup() {
  const { db, query } = makeFakeDb();
  let transactions = 0;
  const deps = {
    db,
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => {
      transactions += 1;
      return action(db);
    },
  } satisfies ScaleDeps;
  return { deps, query, transactionCount: () => transactions };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

const RATE_FIELDS = { effectiveFrom: "2026-09-01", gameAmount: "48", ratePerKm: "0,425" };

describe("handleCreateScale", () => {
  it("crée le barème et sa première ligne dans une transaction", async () => {
    const { deps, query, transactionCount } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ allowed: true, id: SCALE_ID }] })
      .mockResolvedValueOnce({ rows: [{ found: 1, id: RATE_ID }] });
    expect(
      await handleCreateScale(deps, USER_ID, form({ name: " Comité ", ...RATE_FIELDS })),
    ).toEqual({
      status: "created",
      scaleId: SCALE_ID,
    });
    expect(transactionCount()).toBe(1);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, "Comité", 50]);
    expect(query.mock.calls[1]?.[1]).toEqual([SCALE_ID, USER_ID, "2026-09-01", 4800, "42.50", 200]);
  });

  it("n'ajoute pas de ligne si le nom est déjà pris", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ allowed: true, id: null }] });
    expect(
      await handleCreateScale(deps, USER_ID, form({ name: "Comité", ...RATE_FIELDS })),
    ).toEqual({
      status: "name_taken",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("signale chaque champ invalide sans toucher à la base", async () => {
    const { deps, query } = setup();
    const state = await handleCreateScale(
      deps,
      USER_ID,
      form({ name: "", effectiveFrom: "2026-02-30", gameAmount: "abc", ratePerKm: "0,40" }),
    );
    expect(state).toEqual({ status: "invalid", fields: ["name", "effectiveFrom", "gameAmount"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("considère un champ absent comme invalide", async () => {
    const { deps } = setup();
    expect(await handleCreateScale(deps, USER_ID, form({ name: "Comité" }))).toEqual({
      status: "invalid",
      fields: ["effectiveFrom", "gameAmount", "ratePerKm"],
    });
  });
});

describe("handleAddRate", () => {
  it("ajoute une ligne au barème du propriétaire", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ found: 1, id: RATE_ID }] });
    expect(await handleAddRate(deps, ME, form({ scaleId: SCALE_ID, ...RATE_FIELDS }))).toEqual({
      status: "added",
    });
  });

  it("transmet NULL comme propriétaire pour le barème commun", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ found: 1, id: RATE_ID }] });
    await handleAddRate(deps, { kind: "common" }, form({ scaleId: SCALE_ID, ...RATE_FIELDS }));
    expect(query.mock.calls[0]?.[1]?.[1]).toBeNull();
  });

  it("refuse un identifiant de barème mal formé sans toucher à la base", async () => {
    const { deps, query } = setup();
    expect(await handleAddRate(deps, ME, form({ scaleId: "1", ...RATE_FIELDS }))).toEqual({
      status: "invalid",
      fields: [],
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("relaie les refus de la base", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ found: 0, id: null }] });
    expect(await handleAddRate(deps, ME, form({ scaleId: SCALE_ID, ...RATE_FIELDS }))).toEqual({
      status: "not_found",
    });
  });
});

describe("handleRenameScale", () => {
  it("renomme avec le nom nettoyé", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: SCALE_ID }] });
    expect(
      await handleRenameScale(deps, ME, form({ scaleId: SCALE_ID, name: "  Tournoi  " })),
    ).toEqual({
      status: "renamed",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([SCALE_ID, USER_ID, "Tournoi"]);
  });

  it("signale un nom invalide", async () => {
    const { deps } = setup();
    expect(await handleRenameScale(deps, ME, form({ scaleId: SCALE_ID, name: "a\nb" }))).toEqual({
      status: "invalid",
      fields: ["name"],
    });
  });
});

describe("handleDeleteRate et handleDeleteScale", () => {
  it("supprime une ligne dans une transaction", async () => {
    const { deps, query, transactionCount } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: RATE_ID, rate_count: 2, in_use: false }] })
      .mockResolvedValue({ rows: [] });
    expect(await handleDeleteRate(deps, ME, form({ rateId: RATE_ID }))).toEqual({
      status: "deleted",
    });
    expect(transactionCount()).toBe(1);
  });

  it("traite un identifiant de ligne mal formé comme introuvable", async () => {
    const { deps, query } = setup();
    expect(await handleDeleteRate(deps, ME, form({ rateId: "x" }))).toEqual({
      status: "not_found",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("archive un barème utilisé", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: SCALE_ID, in_use: true }] })
      .mockResolvedValue({ rows: [] });
    expect(await handleDeleteScale(deps, USER_ID, form({ scaleId: SCALE_ID }))).toEqual({
      status: "archived",
    });
  });

  it("traite un identifiant de barème mal formé comme introuvable", async () => {
    const { deps, query } = setup();
    expect(await handleDeleteScale(deps, USER_ID, form({}))).toEqual({ status: "not_found" });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("handleSetLevelDefault", () => {
  it("enregistre le barème choisi pour le niveau", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ division_id: DIVISION_ID }] });
    expect(
      await handleSetLevelDefault(
        deps,
        USER_ID,
        form({ divisionId: DIVISION_ID, scaleId: SCALE_ID }),
      ),
    ).toEqual({ status: "saved" });
  });

  it("revient au barème commun quand la valeur est vide", async () => {
    const { deps, query } = setup();
    expect(
      await handleSetLevelDefault(deps, USER_ID, form({ divisionId: DIVISION_ID, scaleId: "" })),
    ).toEqual({
      status: "saved",
    });
    expect(query.mock.calls[0]?.[0]).toMatch(/^DELETE FROM level_default_scale/);
  });

  it("renvoie not_found si le barème n'est pas un barème actif de l'utilisateur", async () => {
    const { deps } = setup();
    expect(
      await handleSetLevelDefault(
        deps,
        USER_ID,
        form({ divisionId: DIVISION_ID, scaleId: SCALE_ID }),
      ),
    ).toEqual({ status: "not_found" });
  });

  it("refuse une division mal formée", async () => {
    const { deps, query } = setup();
    expect(
      await handleSetLevelDefault(deps, USER_ID, form({ divisionId: "x", scaleId: "" })),
    ).toEqual({
      status: "invalid",
    });
    expect(query).not.toHaveBeenCalled();
  });
});
