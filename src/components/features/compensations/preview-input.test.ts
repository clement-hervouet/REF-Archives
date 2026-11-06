import { describe, expect, it } from "vitest";
import type { CompensationFormData } from "@/server/compensation/form-data";
import { previewInputFromForm, readFormData } from "./preview-input";

const CLUB_A = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const CLUB_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02";
const ADDRESS_A = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";
const ADDRESS_X = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b09";
const DIVISION = "5e2a9c7b-1d4f-4b6e-8a3c-9f0d2e7b1c55";
const SCALE = "0b6d5a8e-2f4c-4d1a-9e3b-7c5f1a2d8e40";

const DATA: CompensationFormData = {
  divisions: [{ id: DIVISION, category: "Departemental", type: "Masculin", level: "1" }],
  scales: [{ id: SCALE, name: "Comité" }],
  defaultScaleByDivision: {},
  clubs: [
    {
      id: CLUB_A,
      name: "BC Béthune",
      address: {
        id: ADDRESS_A,
        street: "Rue A",
        number: null,
        postalCode: "62400",
        city: "Béthune",
        country: null,
      },
    },
    {
      id: CLUB_B,
      name: "ES Arras",
      address: {
        id: ADDRESS_X,
        street: "Rue B",
        number: null,
        postalCode: "62000",
        city: "Arras",
        country: null,
      },
    },
  ],
  addresses: [
    {
      id: ADDRESS_X,
      street: "Rue B",
      number: null,
      postalCode: "59000",
      city: "Lille",
      country: "France",
    },
  ],
  ratesByScale: {
    [SCALE]: [{ effectiveFrom: "2026-01-01", gameAmountCents: 3000, centsPerKm: "40.00" }],
  },
};

function read(values: Record<string, string>) {
  return (name: string) => values[name] ?? "";
}

describe("previewInputFromForm", () => {
  it("lit les clubs existants, le niveau, le barème et l'adresse du club de l'équipe 1", () => {
    const preview = previewInputFromForm(
      read({
        team1Club: CLUB_A,
        team2Club: CLUB_B,
        divisionId: DIVISION,
        scaleId: SCALE,
        date: "2026-11-14",
      }),
      DATA,
    );
    expect(preview).toMatchObject({
      team1Name: "BC Béthune",
      team2Name: "ES Arras",
      category: "Departemental",
      scaleName: "Comité",
      venue: { postalCode: "62400", country: null },
      payerChoice: "",
    });
    expect(preview.rates).toHaveLength(1);
  });

  it("lit un nouveau club de l'équipe 1 et son code postal saisi", () => {
    const preview = previewInputFromForm(
      read({
        team1Club: "new",
        team1Name: " CJF Fougères ",
        team1PostalCode: "35300",
        team1Country: "",
      }),
      DATA,
    );
    expect(preview.team1Name).toBe("CJF Fougères");
    expect(preview.venue).toEqual({ postalCode: "35300", country: null });
  });

  it("prend l'adresse d'exception, connue ou nouvelle", () => {
    expect(
      previewInputFromForm(
        read({ team1Club: CLUB_A, venueException: "on", venueAddress: ADDRESS_X }),
        DATA,
      ).venue,
    ).toEqual({ postalCode: "59000", country: "France" });
    expect(
      previewInputFromForm(
        read({
          team1Club: CLUB_A,
          venueException: "on",
          venueAddress: "new",
          venuePostalCode: "56100",
        }),
        DATA,
      ).venue,
    ).toEqual({ postalCode: "56100", country: null });
  });

  it("laisse vide ce qui n'est pas encore choisi", () => {
    expect(previewInputFromForm(read({}), DATA)).toMatchObject({
      team1Name: null,
      team2Name: null,
      category: null,
      scaleName: null,
      venue: null,
      rates: [],
    });
  });
});

describe("readFormData", () => {
  it("lit un FormData et renvoie une chaîne vide pour un champ absent", () => {
    const data = new FormData();
    data.set("date", "2026-11-14");
    const get = readFormData(data);
    expect(get("date")).toBe("2026-11-14");
    expect(get("time")).toBe("");
  });
});
