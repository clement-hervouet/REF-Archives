import { describe, expect, it } from "vitest";
import { clubFormSchema } from "./clubs";

describe("clubFormSchema", () => {
  it("demande seulement le nom et le code postal", () => {
    expect(
      clubFormSchema.parse({
        name: " BC Béthune ",
        street: " ",
        number: "",
        postalCode: "62400",
        city: "",
        country: "",
      }),
    ).toEqual({
      name: "BC Béthune",
      street: null,
      number: null,
      postalCode: "62400",
      city: null,
      country: null,
    });
  });

  it("refuse un code postal manquant ou invalide", () => {
    for (const postalCode of ["", "@@", "1"]) {
      expect(
        clubFormSchema.safeParse({
          name: "BC Béthune",
          street: "",
          number: "",
          postalCode,
          city: "",
          country: "",
        }).success,
      ).toBe(false);
    }
  });
});
