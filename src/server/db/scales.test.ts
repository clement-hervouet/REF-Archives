import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  MAX_RATES_PER_SCALE,
  MAX_SCALES_PER_USER,
  clearLevelDefault,
  deleteScaleRate,
  deleteUserScale,
  findCommonScaleId,
  insertScale,
  insertScaleRate,
  listLevelDefaults,
  listOwnedScales,
  listSelectableScales,
  renameScale,
  upsertLevelDefault,
} from "./scales";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const COMMON_ID = "7a1e3c5b-9d2f-4e6a-8b0c-1d3e5f7a9b21";
const RATE_ID = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e63";
const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const ME = { kind: "user", userId: USER_ID } as const;
const COMMON = { kind: "common" } as const;

function uniqueViolation(constraint: string): Error {
  return Object.assign(new Error("duplicate key"), { code: "23505", constraint });
}

describe("findCommonScaleId", () => {
  it("renvoie l'identifiant du barème commun", async () => {
    const { db } = makeFakeDb([{ id: COMMON_ID }]);
    expect(await findCommonScaleId(db)).toBe(COMMON_ID);
  });

  it("lève une erreur si la migration n'a pas créé le barème commun", async () => {
    const { db } = makeFakeDb();
    await expect(findCommonScaleId(db)).rejects.toThrow();
  });
});

describe("listOwnedScales", () => {
  it("regroupe les lignes par barème", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [{ id: SCALE_ID, name: "Comité", is_common: false }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: RATE_ID,
            scale_id: SCALE_ID,
            effective_from: "2026-09-01",
            game_amount_cents: 4800,
            cents_per_km: "42.50",
            in_use: true,
          },
        ],
      });
    expect(await listOwnedScales(db, ME)).toEqual([
      {
        id: SCALE_ID,
        name: "Comité",
        isCommon: false,
        rates: [
          {
            id: RATE_ID,
            effectiveFrom: "2026-09-01",
            gameAmountCents: 4800,
            centsPerKm: "42.50",
            inUse: true,
          },
        ],
      },
    ]);
  });

  it("filtre par l'utilisateur, ou par NULL pour le barème commun", async () => {
    const mine = makeFakeDb();
    await listOwnedScales(mine.db, ME);
    expect(mine.query.mock.calls.map((call) => call[1])).toEqual([[USER_ID], [USER_ID]]);

    const common = makeFakeDb();
    await listOwnedScales(common.db, COMMON);
    expect(common.query.mock.calls.map((call) => call[1])).toEqual([[null], [null]]);
  });

  it("renvoie un barème sans ligne avec une liste vide", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [{ id: SCALE_ID, name: "Comité", is_common: false }] })
      .mockResolvedValueOnce({ rows: [] });
    expect((await listOwnedScales(db, ME))[0]?.rates).toEqual([]);
  });
});

describe("listSelectableScales et listLevelDefaults", () => {
  it("mappe les barèmes sélectionnables", async () => {
    const { db, query } = makeFakeDb([{ id: COMMON_ID, name: "Barème commun", is_common: true }]);
    expect(await listSelectableScales(db, USER_ID)).toEqual([
      { id: COMMON_ID, name: "Barème commun", isCommon: true },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID]);
  });

  it("mappe les barèmes par défaut", async () => {
    const { db } = makeFakeDb([{ division_id: DIVISION_ID, scale_id: SCALE_ID }]);
    expect(await listLevelDefaults(db, USER_ID)).toEqual([
      { divisionId: DIVISION_ID, scaleId: SCALE_ID },
    ]);
  });
});

describe("insertScale", () => {
  it("crée le barème sous la limite", async () => {
    const { db, query } = makeFakeDb([{ allowed: true, id: SCALE_ID }]);
    expect(await insertScale(db, { userId: USER_ID, name: "Comité" })).toEqual({
      status: "created",
      scaleId: SCALE_ID,
    });
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, "Comité", MAX_SCALES_PER_USER]);
  });

  it("signale un nom déjà pris", async () => {
    const { db } = makeFakeDb([{ allowed: true, id: null }]);
    expect(await insertScale(db, { userId: USER_ID, name: "Comité" })).toEqual({
      status: "name_taken",
    });
  });

  it("signale la limite atteinte", async () => {
    const { db } = makeFakeDb([{ allowed: false, id: null }]);
    expect(await insertScale(db, { userId: USER_ID, name: "Comité" })).toEqual({
      status: "limit_reached",
    });
  });
});

describe("renameScale", () => {
  it("renomme un barème du propriétaire", async () => {
    const { db, query } = makeFakeDb([{ id: SCALE_ID }]);
    expect(await renameScale(db, { scaleId: SCALE_ID, owner: ME, name: "Nouveau" })).toEqual({
      status: "renamed",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([SCALE_ID, USER_ID, "Nouveau"]);
  });

  it("passe NULL comme propriétaire pour le barème commun", async () => {
    const { db, query } = makeFakeDb([{ id: COMMON_ID }]);
    await renameScale(db, { scaleId: COMMON_ID, owner: COMMON, name: "Barème FFBB" });
    expect(query.mock.calls[0]?.[1]).toEqual([COMMON_ID, null, "Barème FFBB"]);
  });

  it("renvoie not_found si le barème n'est pas au propriétaire", async () => {
    const { db } = makeFakeDb();
    expect(await renameScale(db, { scaleId: SCALE_ID, owner: ME, name: "X" })).toEqual({
      status: "not_found",
    });
  });

  it("traduit la contrainte d'unicité du nom", async () => {
    const { db, query } = makeFakeDb();
    query.mockRejectedValue(uniqueViolation("scale_user_name_active_key"));
    expect(await renameScale(db, { scaleId: SCALE_ID, owner: ME, name: "X" })).toEqual({
      status: "name_taken",
    });
  });

  it("relance les autres erreurs", async () => {
    const { db, query } = makeFakeDb();
    const failure = uniqueViolation("autre_contrainte");
    query.mockRejectedValue(failure);
    await expect(renameScale(db, { scaleId: SCALE_ID, owner: ME, name: "X" })).rejects.toBe(
      failure,
    );
  });
});

describe("deleteUserScale", () => {
  it("renvoie not_found si le barème n'est pas à l'utilisateur", async () => {
    const { db, query } = makeFakeDb();
    expect(await deleteUserScale(db, { scaleId: SCALE_ID, userId: USER_ID })).toEqual({
      status: "not_found",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("supprime un barème inutilisé", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [{ id: SCALE_ID, in_use: false }] })
      .mockResolvedValue({ rows: [] });
    expect(await deleteUserScale(db, { scaleId: SCALE_ID, userId: USER_ID })).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[1]?.[0]).toMatch(/^DELETE FROM scale /);
  });

  it("archive un barème utilisé et retire ses défauts", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [{ id: SCALE_ID, in_use: true }] })
      .mockResolvedValue({ rows: [] });
    expect(await deleteUserScale(db, { scaleId: SCALE_ID, userId: USER_ID })).toEqual({
      status: "archived",
    });
    expect(query.mock.calls[1]?.[0]).toMatch(/SET deleted_at = now\(\)/);
    expect(query.mock.calls[2]?.[0]).toMatch(/DELETE FROM level_default_scale/);
  });
});

describe("insertScaleRate", () => {
  const input = {
    scaleId: SCALE_ID,
    owner: ME,
    effectiveFrom: "2026-09-01",
    gameAmountCents: 4800,
    centsPerKm: "42.50",
  };

  it("ajoute la ligne et transmet les valeurs exactes", async () => {
    const { db, query } = makeFakeDb([{ found: 1, id: RATE_ID }]);
    expect(await insertScaleRate(db, input)).toEqual({ status: "added", rateId: RATE_ID });
    expect(query.mock.calls[0]?.[1]).toEqual([
      SCALE_ID,
      USER_ID,
      "2026-09-01",
      4800,
      "42.50",
      MAX_RATES_PER_SCALE,
    ]);
  });

  it("renvoie not_found si le barème n'est pas au propriétaire", async () => {
    const { db } = makeFakeDb([{ found: 0, id: null }]);
    expect(await insertScaleRate(db, input)).toEqual({ status: "not_found" });
  });

  it("signale la limite de lignes", async () => {
    const { db } = makeFakeDb([{ found: 1, id: null }]);
    expect(await insertScaleRate(db, input)).toEqual({ status: "limit_reached" });
  });

  it("traduit une date d'application déjà utilisée", async () => {
    const { db, query } = makeFakeDb();
    query.mockRejectedValue(uniqueViolation("scale_rate_scale_effective_from_key"));
    expect(await insertScaleRate(db, input)).toEqual({ status: "date_taken" });
  });
});

describe("deleteScaleRate", () => {
  it("renvoie not_found si la ligne n'est pas au propriétaire", async () => {
    const { db } = makeFakeDb();
    expect(await deleteScaleRate(db, { rateId: RATE_ID, owner: ME })).toEqual({
      status: "not_found",
    });
  });

  it("refuse une ligne utilisée", async () => {
    const { db, query } = makeFakeDb([{ id: RATE_ID, rate_count: 3, in_use: true }]);
    expect(await deleteScaleRate(db, { rateId: RATE_ID, owner: ME })).toEqual({ status: "in_use" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse de supprimer la dernière ligne", async () => {
    const { db, query } = makeFakeDb([{ id: RATE_ID, rate_count: 1, in_use: false }]);
    expect(await deleteScaleRate(db, { rateId: RATE_ID, owner: ME })).toEqual({
      status: "last_rate",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("supprime une ligne inutilisée", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [{ id: RATE_ID, rate_count: 2, in_use: false }] })
      .mockResolvedValue({ rows: [] });
    expect(await deleteScaleRate(db, { rateId: RATE_ID, owner: COMMON })).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([RATE_ID, null]);
    expect(query.mock.calls[1]?.[1]).toEqual([RATE_ID]);
  });
});

describe("barèmes par défaut", () => {
  it("enregistre un défaut valide", async () => {
    const { db, query } = makeFakeDb([{ division_id: DIVISION_ID }]);
    expect(
      await upsertLevelDefault(db, { userId: USER_ID, divisionId: DIVISION_ID, scaleId: SCALE_ID }),
    ).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, DIVISION_ID, SCALE_ID]);
  });

  it("renvoie false si le barème ou la division ne conviennent pas", async () => {
    const { db } = makeFakeDb();
    expect(
      await upsertLevelDefault(db, { userId: USER_ID, divisionId: DIVISION_ID, scaleId: SCALE_ID }),
    ).toBe(false);
  });

  it("supprime le défaut d'un niveau pour l'utilisateur seulement", async () => {
    const { db, query } = makeFakeDb();
    await clearLevelDefault(db, { userId: USER_ID, divisionId: DIVISION_ID });
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, DIVISION_ID]);
  });
});
