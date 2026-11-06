import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  compensationFormValues,
  fieldOfIssuePath,
  handleCreateCompensation,
  handleDeleteCompensation,
  handleUpdateCompensation,
  readCompensationFormData,
} from "./compensation-form";
import type { CompensationDeps } from "./create-compensation";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const DIVISION_ID = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const SCALE_ID = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";
const RATE_ID = "c4e6a8b0-2d4f-4a6c-9e1b-3d5f7a9c1e61";
const CLUB_A = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const CLUB_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02";
const ADDRESS_A = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";
const ADDRESS_B = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b02";
const TEAM_1 = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01";
const TEAM_2 = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02";
const COMPENSATION_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";

const BASE: Record<string, string> = {
  date: "2026-11-14",
  time: "19:00",
  divisionId: DIVISION_ID,
  scaleId: SCALE_ID,
  team1Club: CLUB_A,
  team2Club: CLUB_B,
  oneWayDistance: "23,5",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies CompensationDeps;
  return { deps, query };
}

describe("readCompensationFormData", () => {
  it("lit des clubs existants et l'adresse de l'équipe 1 par défaut", () => {
    expect(readCompensationFormData(form(BASE))).toEqual({
      date: "2026-11-14",
      time: "19:00",
      divisionId: DIVISION_ID,
      scaleId: SCALE_ID,
      payer: "",
      team1: { kind: "existing", clubId: CLUB_A },
      team2: { kind: "existing", clubId: CLUB_B },
      venue: { kind: "team1" },
      oneWayDistance: "23,5",
    });
  });

  it("lit l'organisme choisi (bloc 10)", () => {
    expect(readCompensationFormData(form({ ...BASE, payer: "ligue-bretagne" })).payer).toBe(
      "ligue-bretagne",
    );
  });

  it("lit un nouveau club et une nouvelle adresse d'exception", () => {
    const data = readCompensationFormData(
      form({
        ...BASE,
        team1Club: "new",
        team1Name: "BC Béthune",
        team1Street: "Avenue du Sport",
        team1PostalCode: "62400",
        team1City: "Béthune",
        venueException: "on",
        venueAddress: "new",
        venueStreet: "Rue du Gymnase",
        venueNumber: "3",
        venuePostalCode: "62400",
        venueCity: "Béthune",
        venueCountry: "FR",
      }),
    );
    expect(data.team1).toEqual({
      kind: "new",
      name: "BC Béthune",
      address: {
        street: "Avenue du Sport",
        number: "",
        postalCode: "62400",
        city: "Béthune",
        country: "",
      },
    });
    expect(data.venue).toEqual({
      kind: "new",
      address: {
        street: "Rue du Gymnase",
        number: "3",
        postalCode: "62400",
        city: "Béthune",
        country: "FR",
      },
    });
  });

  it("ignore l'adresse d'exception si la case n'est pas cochée", () => {
    expect(readCompensationFormData(form({ ...BASE, venueAddress: ADDRESS_B })).venue).toEqual({
      kind: "team1",
    });
  });

  it("lit une adresse d'exception déjà connue", () => {
    expect(
      readCompensationFormData(form({ ...BASE, venueException: "on", venueAddress: ADDRESS_B }))
        .venue,
    ).toEqual({ kind: "existing", addressId: ADDRESS_B });
  });

  it("transforme un fichier en valeur absente", () => {
    const data = form(BASE);
    data.set("date", new Blob(["x"]));
    expect(readCompensationFormData(data).date).toBeUndefined();
  });
});

describe("fieldOfIssuePath", () => {
  it("relie chaque erreur Zod au bon champ du formulaire", () => {
    expect(fieldOfIssuePath(["date"])).toBe("date");
    expect(fieldOfIssuePath(["team1", "clubId"])).toBe("team1");
    expect(fieldOfIssuePath(["team2"])).toBe("team2");
    expect(fieldOfIssuePath(["team1", "name"])).toBe("team1.name");
    expect(fieldOfIssuePath(["team2", "address", "postalCode"])).toBe("team2.postalCode");
    expect(fieldOfIssuePath(["venue", "addressId"])).toBe("venue");
    expect(fieldOfIssuePath(["venue", "address", "city"])).toBe("venue.city");
    expect(fieldOfIssuePath([])).toBeNull();
    expect(fieldOfIssuePath(["inconnu"])).toBeNull();
  });
});

describe("handleCreateCompensation", () => {
  it("crée l'indemnité et renvoie son montant", async () => {
    const { deps, query } = setup();
    for (const rows of [
      [{ id: DIVISION_ID }],
      [
        {
          id: RATE_ID,
          effective_from: "2026-01-01",
          game_amount_cents: 3000,
          cents_per_km: "40.00",
        },
      ],
      [
        { id: CLUB_A, address_id: ADDRESS_A },
        { id: CLUB_B, address_id: ADDRESS_B },
      ],
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [{ id: COMPENSATION_ID }],
    ]) {
      query.mockResolvedValueOnce({ rows });
    }
    expect(await handleCreateCompensation(deps, USER_ID, form(BASE))).toEqual({
      status: "created",
      amount: { gameCents: 3000, mileageCents: 1880, totalCents: 4880 },
    });
  });

  it("signale les champs invalides dans l'ordre du formulaire, sans requête", async () => {
    const { deps, query } = setup();
    const state = await handleCreateCompensation(
      deps,
      USER_ID,
      form({
        ...BASE,
        oneWayDistance: "beaucoup",
        team1Club: "new",
        team1Name: "",
        team1Street: "Rue",
        team1PostalCode: "6",
        team1City: "Béthune",
        date: "",
      }),
    );
    expect(state).toEqual({
      status: "invalid",
      fields: ["date", "team1.name", "team1.postalCode", "oneWayDistance"],
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("signale une liste de club vide sur le champ de l'équipe", async () => {
    const { deps } = setup();
    expect(await handleCreateCompensation(deps, USER_ID, form({ ...BASE, team2Club: "" }))).toEqual(
      { status: "invalid", fields: ["team2"] },
    );
  });

  it("transmet les refus du service", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    expect(await handleCreateCompensation(deps, USER_ID, form(BASE))).toEqual({
      status: "not_found",
      field: "divisionId",
    });
  });
});

describe("handleUpdateCompensation", () => {
  it("refuse un identifiant d'indemnité invalide sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleUpdateCompensation(deps, USER_ID, form({ ...BASE, compensationId: "1" })),
    ).toEqual({ status: "not_found", field: "compensation" });
    expect(query).not.toHaveBeenCalled();
  });

  it("valide le formulaire avant toute requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleUpdateCompensation(
        deps,
        USER_ID,
        form({ ...BASE, compensationId: COMPENSATION_ID, oneWayDistance: "x" }),
      ),
    ).toEqual({ status: "invalid", fields: ["oneWayDistance"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("modifie l'indemnité de l'utilisateur", async () => {
    const { deps, query } = setup();
    for (const rows of [
      [{ id: COMPENSATION_ID }],
      [{ id: DIVISION_ID }],
      [
        {
          id: RATE_ID,
          effective_from: "2026-01-01",
          game_amount_cents: 3000,
          cents_per_km: "40.00",
        },
      ],
      [
        { id: CLUB_A, address_id: ADDRESS_A },
        { id: CLUB_B, address_id: ADDRESS_B },
      ],
      [{ id: TEAM_1 }],
      [{ id: TEAM_2 }],
      [{ id: COMPENSATION_ID }],
    ]) {
      query.mockResolvedValueOnce({ rows });
    }
    expect(
      await handleUpdateCompensation(
        deps,
        USER_ID,
        form({ ...BASE, compensationId: COMPENSATION_ID }),
      ),
    ).toEqual({
      status: "updated",
      amount: { gameCents: 3000, mileageCents: 1880, totalCents: 4880 },
    });
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });
});

describe("handleDeleteCompensation", () => {
  it("supprime l'indemnité de l'utilisateur", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: COMPENSATION_ID }] });
    expect(
      await handleDeleteCompensation(deps, USER_ID, form({ compensationId: COMPENSATION_ID })),
    ).toEqual({ status: "deleted" });
    expect(query.mock.calls[0]?.[1]).toEqual([COMPENSATION_ID, USER_ID]);
  });

  it("répond introuvable pour l'indemnité d'un autre utilisateur ou déjà supprimée", async () => {
    const { deps } = setup();
    expect(
      await handleDeleteCompensation(deps, USER_ID, form({ compensationId: COMPENSATION_ID })),
    ).toEqual({ status: "not_found" });
  });

  it("refuse un identifiant invalide sans requête", async () => {
    const { deps, query } = setup();
    expect(await handleDeleteCompensation(deps, USER_ID, form({ compensationId: "x" }))).toEqual({
      status: "not_found",
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("compensationFormValues", () => {
  const compensation = {
    id: COMPENSATION_ID,
    startsAt: new Date("2026-11-14T18:00:00Z"),
    divisionId: DIVISION_ID,
    team1ClubId: CLUB_A,
    team2ClubId: CLUB_B,
    addressId: ADDRESS_A,
    team1AddressId: ADDRESS_A,
    scaleId: SCALE_ID,
    distanceM: 47_000,
    payer: null,
  };

  it("préremplit le formulaire à l'heure de Paris, distance aller", () => {
    expect(compensationFormValues(compensation)).toEqual({
      compensationId: COMPENSATION_ID,
      date: "2026-11-14",
      time: "19:00",
      divisionId: DIVISION_ID,
      scaleId: SCALE_ID,
      payer: "",
      team1Club: CLUB_A,
      team2Club: CLUB_B,
      oneWayDistance: "23,5",
    });
  });

  it("préremplit l'organisme choisi", () => {
    expect(compensationFormValues({ ...compensation, payer: "federation" }).payer).toBe(
      "federation",
    );
  });

  it("coche l'exception quand l'adresse diffère de celle du club de l'équipe 1", () => {
    const values = compensationFormValues({ ...compensation, addressId: ADDRESS_B });
    expect(values.venueException).toBe("on");
    expect(values.venueAddress).toBe(ADDRESS_B);
  });

  it("produit des valeurs que le formulaire relit à l'identique", () => {
    const values = compensationFormValues({ ...compensation, addressId: ADDRESS_B });
    expect(readCompensationFormData(form(values))).toMatchObject({
      date: "2026-11-14",
      time: "19:00",
      venue: { kind: "existing", addressId: ADDRESS_B },
      oneWayDistance: "23,5",
    });
  });
});
