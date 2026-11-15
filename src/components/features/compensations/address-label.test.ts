import { describe, expect, it } from "vitest";
import { addressLabel, clubPlace, isCompleteAddress } from "./address-label";

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

describe("addressLabel (adresse partielle)", () => {
  it("affiche le code postal seul quand il n'y a ni rue ni ville", () => {
    expect(addressLabel({ street: null, number: null, postalCode: "62400", city: null })).toBe(
      "62400",
    );
  });

  it("affiche le code postal et la ville sans rue", () => {
    expect(addressLabel({ street: null, number: "2", postalCode: "62400", city: "Béthune" })).toBe(
      "62400 Béthune",
    );
  });

  it("affiche la rue et le code postal sans ville", () => {
    expect(
      addressLabel({ street: "Rue Gambetta", number: null, postalCode: "62000", city: null }),
    ).toBe("Rue Gambetta, 62000");
  });
});

describe("isCompleteAddress", () => {
  it("demande la rue et la ville", () => {
    expect(isCompleteAddress({ street: "Rue Gambetta", city: "Arras" })).toBe(true);
    expect(isCompleteAddress({ street: null, city: "Arras" })).toBe(false);
    expect(isCompleteAddress({ street: "Rue Gambetta", city: null })).toBe(false);
  });
});

describe("clubPlace", () => {
  it("préfère la ville, sinon le code postal", () => {
    expect(clubPlace({ postalCode: "62000", city: "Arras" })).toBe("Arras");
    expect(clubPlace({ postalCode: "62000", city: null })).toBe("62000");
  });
});
