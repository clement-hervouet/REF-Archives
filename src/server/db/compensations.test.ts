import { describe, expect, it } from "vitest";
import {
  MAX_CLUBS_PER_USER,
  MAX_COMPENSATIONS_PER_USER,
  addressBelongsTo,
  divisionExists,
  ensureTeam,
  findCompensationForEdit,
  insertAddress,
  insertClub,
  insertCompensation,
  listApplicableRates,
  listCompensationAmounts,
  listCompensationsInRange,
  lockCompensation,
  lockOwnedClubs,
  softDeleteCompensation,
  updateCompensation,
} from "./compensations";
import { makeFakeDb } from "./fake-db";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const RATE_ID = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e63";
const ADDRESS_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";
const CLUB_A = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const CLUB_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02";
const TEAM_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";

const ADDRESS = {
  street: "Avenue du Sport",
  number: null,
  postalCode: "62400",
  city: "Béthune",
  country: null,
};

describe("divisionExists", () => {
  it("vrai si la division existe", async () => {
    const { db, query } = makeFakeDb([{ id: DIVISION_ID }]);
    expect(await divisionExists(db, DIVISION_ID)).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual([DIVISION_ID]);
  });

  it("faux sinon", async () => {
    const { db } = makeFakeDb();
    expect(await divisionExists(db, DIVISION_ID)).toBe(false);
  });
});

describe("listApplicableRates", () => {
  it("renvoie les lignes d'un barème choisissable, filtré par utilisateur", async () => {
    const { db, query } = makeFakeDb([
      {
        id: RATE_ID,
        effective_from: "2026-09-01",
        game_amount_cents: 4800,
        cents_per_km: "42.50",
      },
    ]);
    expect(await listApplicableRates(db, { scaleId: SCALE_ID, userId: USER_ID })).toEqual([
      { id: RATE_ID, effectiveFrom: "2026-09-01", gameAmountCents: 4800, centsPerKm: "42.50" },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([SCALE_ID, USER_ID]);
  });

  it("renvoie une liste vide pour un barème choisissable sans ligne", async () => {
    const { db } = makeFakeDb([
      { id: null, effective_from: null, game_amount_cents: null, cents_per_km: null },
    ]);
    expect(await listApplicableRates(db, { scaleId: SCALE_ID, userId: USER_ID })).toEqual([]);
  });

  it("renvoie null pour un barème introuvable, archivé ou d'un autre utilisateur", async () => {
    const { db } = makeFakeDb();
    expect(await listApplicableRates(db, { scaleId: SCALE_ID, userId: USER_ID })).toBeNull();
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([
      { id: RATE_ID, effective_from: "2026-09-01", game_amount_cents: 48.5, cents_per_km: "42" },
    ]);
    await expect(listApplicableRates(db, { scaleId: SCALE_ID, userId: USER_ID })).rejects.toThrow();
  });
});

describe("insertAddress", () => {
  it("insère l'adresse avec ses champs facultatifs à NULL", async () => {
    const { db, query } = makeFakeDb([{ id: ADDRESS_ID }]);
    expect(await insertAddress(db, { userId: USER_ID, address: ADDRESS })).toBe(ADDRESS_ID);
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      "Avenue du Sport",
      null,
      "62400",
      "Béthune",
      null,
    ]);
  });
});

describe("addressBelongsTo", () => {
  it("filtre par utilisateur", async () => {
    const { db, query } = makeFakeDb([{ id: ADDRESS_ID }]);
    expect(await addressBelongsTo(db, { addressId: ADDRESS_ID, userId: USER_ID })).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual([ADDRESS_ID, USER_ID]);
  });

  it("faux pour l'adresse d'un autre utilisateur", async () => {
    const { db } = makeFakeDb();
    expect(await addressBelongsTo(db, { addressId: ADDRESS_ID, userId: USER_ID })).toBe(false);
  });
});

describe("insertClub", () => {
  it("crée le club sous la limite", async () => {
    const { db, query } = makeFakeDb([{ id: CLUB_A }]);
    expect(
      await insertClub(db, { userId: USER_ID, name: "BC Béthune", addressId: ADDRESS_ID }),
    ).toBe(CLUB_A);
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      ADDRESS_ID,
      "BC Béthune",
      MAX_CLUBS_PER_USER,
    ]);
  });

  it("renvoie null quand la limite est atteinte", async () => {
    const { db } = makeFakeDb([{ id: null }]);
    expect(
      await insertClub(db, { userId: USER_ID, name: "BC Béthune", addressId: ADDRESS_ID }),
    ).toBeNull();
  });
});

describe("lockOwnedClubs", () => {
  it("renvoie les clubs de l'utilisateur avec leur adresse", async () => {
    const { db, query } = makeFakeDb([
      { id: CLUB_A, address_id: ADDRESS_ID },
      { id: CLUB_B, address_id: ADDRESS_ID },
    ]);
    const clubs = await lockOwnedClubs(db, { userId: USER_ID, clubIds: [CLUB_B, CLUB_A] });
    expect(clubs.get(CLUB_A)).toEqual({ id: CLUB_A, addressId: ADDRESS_ID });
    expect(clubs.get(CLUB_B)).toEqual({ id: CLUB_B, addressId: ADDRESS_ID });
    expect(query.mock.calls[0]?.[1]).toEqual([[CLUB_B, CLUB_A], USER_ID]);
  });

  it("omet les clubs introuvables ou d'un autre utilisateur", async () => {
    const { db } = makeFakeDb([{ id: CLUB_A, address_id: ADDRESS_ID }]);
    const clubs = await lockOwnedClubs(db, { userId: USER_ID, clubIds: [CLUB_A, CLUB_B] });
    expect(clubs.has(CLUB_B)).toBe(false);
  });

  it("n'interroge pas la base sans club à verrouiller", async () => {
    const { db, query } = makeFakeDb();
    expect((await lockOwnedClubs(db, { userId: USER_ID, clubIds: [] })).size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("ensureTeam", () => {
  const input = { userId: USER_ID, clubId: CLUB_A, divisionId: DIVISION_ID };

  it("réutilise l'équipe existante du club à ce niveau", async () => {
    const { db, query } = makeFakeDb([{ id: TEAM_ID }]);
    expect(await ensureTeam(db, input)).toBe(TEAM_ID);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([CLUB_A, USER_ID, DIVISION_ID]);
  });

  it("crée l'équipe si elle n'existe pas", async () => {
    const { db, query } = makeFakeDb();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: TEAM_ID }] });
    expect(await ensureTeam(db, input)).toBe(TEAM_ID);
    expect(query.mock.calls[1]?.[1]).toEqual([USER_ID, CLUB_A, DIVISION_ID]);
  });
});

describe("insertCompensation", () => {
  const startsAt = new Date("2026-11-14T18:00:00Z");
  const input = {
    userId: USER_ID,
    scaleRateId: RATE_ID,
    distanceM: 47_000,
    startsAt,
    divisionId: DIVISION_ID,
    team1Id: TEAM_ID,
    team2Id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02",
    addressId: ADDRESS_ID,
  };

  it("crée l'indemnité sous la limite", async () => {
    const { db, query } = makeFakeDb([{ id: COMPENSATION_ID }]);
    expect(await insertCompensation(db, input)).toBe(COMPENSATION_ID);
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      RATE_ID,
      47_000,
      startsAt,
      DIVISION_ID,
      TEAM_ID,
      "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02",
      ADDRESS_ID,
      MAX_COMPENSATIONS_PER_USER,
    ]);
  });

  it("renvoie null quand la limite est atteinte", async () => {
    const { db } = makeFakeDb([{ id: null }]);
    expect(await insertCompensation(db, input)).toBeNull();
  });
});

describe("listCompensationAmounts", () => {
  it("lit les montants des indemnités actives de l'utilisateur", async () => {
    const startsAt = new Date("2026-11-14T18:00:00Z");
    const { db, query } = makeFakeDb([
      { starts_at: startsAt, distance_m: 47_000, game_amount_cents: 4800, cents_per_km: "42.50" },
    ]);
    expect(await listCompensationAmounts(db, USER_ID)).toEqual([
      { startsAt, distanceM: 47_000, gameAmountCents: 4800, centsPerKm: "42.50" },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID]);
  });
});

describe("listCompensationsInRange", () => {
  it("filtre par utilisateur et période, et structure chaque ligne", async () => {
    const startsAt = new Date("2026-11-14T18:00:00Z");
    const from = new Date("2026-10-31T23:00:00Z");
    const to = new Date("2026-11-30T23:00:00Z");
    const { db, query } = makeFakeDb([
      {
        id: COMPENSATION_ID,
        starts_at: startsAt,
        distance_m: 47_000,
        game_amount_cents: 4800,
        cents_per_km: "42.50",
        division: "Regional",
        type: "Masculin",
        level: "1",
        team1_name: "Club Alpha",
        team2_name: "Club Beta",
        street: "Rue Nationale",
        number: "10",
        postal_code: "59000",
        city: "Lille",
        scale_name: "Comité",
        game_id: null,
      },
    ]);
    expect(await listCompensationsInRange(db, { userId: USER_ID, from, to })).toEqual([
      {
        id: COMPENSATION_ID,
        startsAt,
        distanceM: 47_000,
        gameAmountCents: 4800,
        centsPerKm: "42.50",
        division: { category: "Regional", type: "Masculin", level: "1" },
        team1Name: "Club Alpha",
        team2Name: "Club Beta",
        address: { street: "Rue Nationale", number: "10", postalCode: "59000", city: "Lille" },
        scaleName: "Comité",
        gameId: null,
      },
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, from, to]);
  });
});

describe("findCompensationForEdit", () => {
  it("renvoie l'indemnité de l'utilisateur", async () => {
    const startsAt = new Date("2026-11-14T18:00:00Z");
    const { db, query } = makeFakeDb([
      {
        id: COMPENSATION_ID,
        starts_at: startsAt,
        division_id: DIVISION_ID,
        address_id: ADDRESS_ID,
        distance_m: 47_000,
        team1_club_id: CLUB_A,
        team2_club_id: CLUB_B,
        team1_address_id: ADDRESS_ID,
        scale_id: SCALE_ID,
      },
    ]);
    expect(
      await findCompensationForEdit(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toEqual({
      id: COMPENSATION_ID,
      startsAt,
      divisionId: DIVISION_ID,
      team1ClubId: CLUB_A,
      team2ClubId: CLUB_B,
      addressId: ADDRESS_ID,
      team1AddressId: ADDRESS_ID,
      scaleId: SCALE_ID,
      distanceM: 47_000,
    });
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });

  it("renvoie null pour une indemnité introuvable, supprimée ou d'un autre", async () => {
    const { db } = makeFakeDb();
    expect(
      await findCompensationForEdit(db, { compensationId: COMPENSATION_ID, userId: USER_ID }),
    ).toBeNull();
  });
});

describe("lockCompensation, updateCompensation, softDeleteCompensation", () => {
  const ids = { compensationId: COMPENSATION_ID, userId: USER_ID };

  it("filtrent toujours par utilisateur", async () => {
    const { db, query } = makeFakeDb([{ id: COMPENSATION_ID }]);
    expect(await lockCompensation(db, ids)).toBe(true);
    expect(await softDeleteCompensation(db, ids)).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
    expect(query.mock.calls[1]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });

  it("passe les nouvelles valeurs dans l'ordre", async () => {
    const startsAt = new Date("2026-11-14T18:00:00Z");
    const { db, query } = makeFakeDb([{ id: COMPENSATION_ID }]);
    expect(
      await updateCompensation(db, {
        ...ids,
        scaleRateId: RATE_ID,
        distanceM: 1000,
        startsAt,
        divisionId: DIVISION_ID,
        team1Id: TEAM_ID,
        team2Id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02",
        addressId: ADDRESS_ID,
      }),
    ).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual([
      COMPENSATION_ID,
      USER_ID,
      RATE_ID,
      1000,
      startsAt,
      DIVISION_ID,
      TEAM_ID,
      "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02",
      ADDRESS_ID,
    ]);
  });

  it("répondent faux quand rien n'est touché", async () => {
    const { db } = makeFakeDb();
    expect(await lockCompensation(db, ids)).toBe(false);
    expect(await softDeleteCompensation(db, ids)).toBe(false);
  });
});
