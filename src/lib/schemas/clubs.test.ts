import { describe, expect, it } from "vitest";
import { clubFormSchema } from "./clubs";

describe("clubFormSchema", () => {
  it("demande seulement le nom et le code postal", () => {
    expect(
      clubFormSchema.parse({
        name: " BC Béthune ",
        venueName: "",
        street: " ",
        number: "",
        postalCode: "62400",
        city: "",
        country: "",
        venues: [],
      }),
    ).toEqual({
      name: "BC BÉTHUNE",
      venueName: null,
      street: null,
      number: null,
      postalCode: "62400",
      city: null,
      country: null,
      venues: [],
    });
  });

  it("garde le nom de la salle et les autres salles importées", () => {
    const parsed = clubFormSchema.parse({
      name: "Rennes Avenir",
      venueName: " Gymnase de la Courrouze ",
      street: "",
      number: "",
      postalCode: "35000",
      city: "",
      country: "",
      venues: [
        { name: "Salle du Berry", street: "", number: "", postalCode: "35000", city: "Rennes" },
      ],
    });
    expect(parsed.venueName).toBe("Gymnase de la Courrouze");
    expect(parsed.venues).toEqual([
      { name: "Salle du Berry", street: null, number: null, postalCode: "35000", city: "Rennes" },
    ]);
  });

  it("accepte les salles de l'annuaire FFBB telles que le navigateur les envoie (null)", () => {
    const venues: unknown = JSON.parse(
      JSON.stringify([
        {
          name: "Salle du Berry",
          number: null,
          street: "Square du Berry",
          postalCode: "35000",
          city: "Rennes",
        },
        { name: null, number: null, street: null, postalCode: "35000", city: null },
      ]),
    );
    const parsed = clubFormSchema.safeParse({
      name: "Rennes Avenir",
      venueName: "",
      street: "",
      number: "",
      postalCode: "35000",
      city: "",
      country: "",
      venues,
    });
    expect(parsed.success && parsed.data.venues).toEqual([
      {
        name: "Salle du Berry",
        number: null,
        street: "Square du Berry",
        postalCode: "35000",
        city: "Rennes",
      },
      { name: null, number: null, street: null, postalCode: "35000", city: null },
    ]);
  });

  it("refuse une liste de salles invalide ou trop longue", () => {
    const base = {
      name: "Rennes Avenir",
      venueName: "",
      street: "",
      number: "",
      postalCode: "35000",
      city: "",
      country: "",
    };
    const venue = { name: "", street: "", number: "", postalCode: "35000", city: "" };
    expect(clubFormSchema.safeParse({ ...base, venues: "x" }).success).toBe(false);
    expect(
      clubFormSchema.safeParse({ ...base, venues: [{ ...venue, postalCode: "" }] }).success,
    ).toBe(false);
    expect(
      clubFormSchema.safeParse({ ...base, venues: Array.from({ length: 20 }, () => venue) })
        .success,
    ).toBe(false);
  });

  it("refuse un code postal manquant ou invalide", () => {
    for (const postalCode of ["", "@@", "1"]) {
      expect(
        clubFormSchema.safeParse({
          name: "BC Béthune",
          venueName: "",
          street: "",
          number: "",
          postalCode,
          city: "",
          country: "",
          venues: [],
        }).success,
      ).toBe(false);
    }
  });
});
