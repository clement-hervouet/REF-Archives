import { describe, expect, it } from "vitest";
import { addressLabel } from "./address-label";

describe("addressLabel", () => {
  it("place le numéro devant la rue", () => {
    expect(
      addressLabel({
        street: "Avenue du Sport",
        number: "2",
        postalCode: "62400",
        city: "Béthune",
      }),
    ).toBe("2 Avenue du Sport, 62400 Béthune");
  });

  it("omet le numéro absent", () => {
    expect(
      addressLabel({ street: "Rue Gambetta", number: null, postalCode: "62000", city: "Arras" }),
    ).toBe("Rue Gambetta, 62000 Arras");
  });
});
