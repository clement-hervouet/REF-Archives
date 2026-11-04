import { describe, expect, it } from "vitest";
import { compensationFormSchema, type CompensationFormInput } from "@/lib/schemas/compensations";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { createCompensation, type CompensationDeps } from "./create-compensation";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const RATE_OLD = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e61";
const RATE_NEW = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e62";
const CLUB_A = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const CLUB_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02";
const CLUB_NEW = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c03";
const ADDRESS_A = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";
const ADDRESS_B = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b02";
const ADDRESS_NEW = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b03";
const TEAM_1 = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01";
const TEAM_2 = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";

const ADDRESS = {
  street: "Rue du Gymnase",
  number: "",
  postalCode: "62400",
  city: "Béthune",
  country: "",
};

const RATES = [
  { id: RATE_OLD, effective_from: "2026-01-01", game_amount_cents: 4500, cents_per_km: "40.00" },
  { id: RATE_NEW, effective_from: "2026-09-01", game_amount_cents: 4800, cents_per_km: "42.50" },
];

function form(overrides: Partial<CompensationFormInput> = {}) {
  return compensationFormSchema.parse({
    date: "2026-11-14",
    time: "19:00",
    divisionId: DIVISION_ID,
    team1: { kind: "existing", clubId: CLUB_A },
    team2: { kind: "existing", clubId: CLUB_B },
    venue: { kind: "team1" },
    scaleId: SCALE_ID,
    oneWayDistance: "23,5",
    ...overrides,
  });
}

function setup() {
  const { db, query } = makeFakeDb();
  let transactions = 0;
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => {
      transactions += 1;
      return action(db);
    },
  } satisfies CompensationDeps;
  return { deps, query, transactionCount: () => transactions };
}

/** Réponses SQL dans l'ordre des requêtes du service. */
function answer(query: ReturnType<typeof setup>["query"], ...rows: Record<string, unknown>[][]) {
  for (const result of rows) {
    query.mockResolvedValueOnce({ rows: result });
  }
}

const BOTH_CLUBS = [
  { id: CLUB_A, address_id: ADDRESS_A },
  { id: CLUB_B, address_id: ADDRESS_B },
];

describe("createCompensation", () => {
  it("crée l'indemnité avec la ligne en vigueur et l'adresse du club de l'équipe 1", async () => {
    const { deps, query, transactionCount } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      RATES,
      BOTH_CLUBS,
      [{ id: TEAM_1 }],
      [],
      [{ id: TEAM_2 }],
      [{ id: COMPENSATION_ID }],
    );

    expect(await createCompensation(deps, USER_ID, form())).toEqual({
      status: "created",
      compensationId: COMPENSATION_ID,
      // 47 km × 0,425 €/km = 19,975 € → 19,98 € (arrondi au centime, demi vers le haut).
      amount: { gameCents: 4800, mileageCents: 1998, totalCents: 6798 },
    });
    expect(transactionCount()).toBe(1);
    // Équipe 2 introuvable à ce niveau : créée.
    expect(query.mock.calls[5]?.[1]).toEqual([USER_ID, CLUB_B, DIVISION_ID]);
    expect(query.mock.calls[6]?.[1]).toEqual([
      USER_ID,
      RATE_NEW,
      47_000,
      new Date("2026-11-14T18:00:00Z"),
      DIVISION_ID,
      TEAM_1,
      TEAM_2,
      ADDRESS_A,
      10_000,
    ]);
  });

  it("choisit la ligne selon le jour du match à Paris, pas en UTC", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      RATES,
      BOTH_CLUBS,
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [{ id: COMPENSATION_ID }],
    );
    // 01/09/2026 à 00:30 à Paris = 31/08/2026 22:30 UTC : la ligne du 01/09 s'applique.
    const result = await createCompensation(
      deps,
      USER_ID,
      form({ date: "2026-09-01", time: "00:30" }),
    );
    expect(result.status).toBe("created");
    expect(query.mock.calls[5]?.[1]?.[1]).toBe(RATE_NEW);
  });

  it("crée les clubs et l'adresse d'exception à la volée", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      RATES,
      [{ id: CLUB_B, address_id: ADDRESS_B }],
      [{ id: ADDRESS_A }],
      [{ id: CLUB_NEW }],
      [{ id: ADDRESS_NEW }],
      [],
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [{ id: COMPENSATION_ID }],
    );

    const result = await createCompensation(
      deps,
      USER_ID,
      form({
        team1: { kind: "new", name: "BC Béthune", address: ADDRESS },
        venue: { kind: "new", address: { ...ADDRESS, street: "Salle Pierre de Coubertin" } },
      }),
    );

    expect(result.status).toBe("created");
    // Seul le club existant est verrouillé.
    expect(query.mock.calls[2]?.[1]).toEqual([[CLUB_B], USER_ID]);
    expect(query.mock.calls[4]?.[1]).toEqual([USER_ID, ADDRESS_A, "BC Béthune", 1000]);
    expect(query.mock.calls[5]?.[1]?.[1]).toBe("Salle Pierre de Coubertin");
    // L'indemnité prend l'adresse d'exception, pas celle du nouveau club.
    expect(query.mock.calls[9]?.[1]?.[7]).toBe(ADDRESS_NEW);
  });

  it("accepte une adresse d'exception déjà connue de l'utilisateur", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      RATES,
      BOTH_CLUBS,
      [{ id: ADDRESS_NEW }],
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [{ id: COMPENSATION_ID }],
    );
    const result = await createCompensation(
      deps,
      USER_ID,
      form({ venue: { kind: "existing", addressId: ADDRESS_NEW } }),
    );
    expect(result.status).toBe("created");
    expect(query.mock.calls[3]?.[1]).toEqual([ADDRESS_NEW, USER_ID]);
  });

  it("refuse un niveau inconnu sans rien écrire", async () => {
    const { deps, query } = setup();
    answer(query, []);
    expect(await createCompensation(deps, USER_ID, form())).toEqual({
      status: "not_found",
      field: "divisionId",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse un barème introuvable ou d'un autre utilisateur", async () => {
    const { deps, query } = setup();
    answer(query, [{ id: DIVISION_ID }], []);
    expect(await createCompensation(deps, USER_ID, form())).toEqual({
      status: "not_found",
      field: "scaleId",
    });
  });

  it("refuse un match antérieur à la première ligne du barème", async () => {
    const { deps, query } = setup();
    answer(query, [{ id: DIVISION_ID }], RATES);
    expect(await createCompensation(deps, USER_ID, form({ date: "2025-12-31" }))).toEqual({
      status: "no_rate_at_date",
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("refuse un barème sans aucune ligne", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      [{ id: null, effective_from: null, game_amount_cents: null, cents_per_km: null }],
    );
    expect(await createCompensation(deps, USER_ID, form())).toEqual({
      status: "no_rate_at_date",
    });
  });

  it("refuse un club d'équipe 2 qui n'est pas à l'utilisateur", async () => {
    const { deps, query } = setup();
    answer(query, [{ id: DIVISION_ID }], RATES, [{ id: CLUB_A, address_id: ADDRESS_A }]);
    expect(await createCompensation(deps, USER_ID, form())).toEqual({
      status: "not_found",
      field: "team2",
    });
  });

  it("refuse une adresse d'exception qui n'est pas à l'utilisateur", async () => {
    const { deps, query } = setup();
    answer(query, [{ id: DIVISION_ID }], RATES, BOTH_CLUBS, []);
    expect(
      await createCompensation(
        deps,
        USER_ID,
        form({ venue: { kind: "existing", addressId: ADDRESS_NEW } }),
      ),
    ).toEqual({ status: "not_found", field: "venue" });
  });

  it("annule tout si la limite de clubs est atteinte", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      RATES,
      [{ id: CLUB_B, address_id: ADDRESS_B }],
      [{ id: ADDRESS_A }],
      [{ id: null }],
    );
    expect(
      await createCompensation(
        deps,
        USER_ID,
        form({ team1: { kind: "new", name: "BC Béthune", address: ADDRESS } }),
      ),
    ).toEqual({ status: "limit_reached", resource: "club" });
  });

  it("annule tout si la limite d'indemnités est atteinte", async () => {
    const { deps, query } = setup();
    answer(
      query,
      [{ id: DIVISION_ID }],
      RATES,
      BOTH_CLUBS,
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [{ id: null }],
    );
    expect(await createCompensation(deps, USER_ID, form())).toEqual({
      status: "limit_reached",
      resource: "compensation",
    });
  });

  it("laisse remonter une erreur technique", async () => {
    const { deps, query } = setup();
    query.mockRejectedValueOnce(new Error("connexion perdue"));
    await expect(createCompensation(deps, USER_ID, form())).rejects.toThrow("connexion perdue");
  });
});
