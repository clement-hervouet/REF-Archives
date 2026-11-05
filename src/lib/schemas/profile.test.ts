import { describe, expect, it } from "vitest";
import { PERSON_NAME_MAX, parseProfile, parseProfileForm } from "./profile";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }
  return data;
}

describe("parseProfile", () => {
  it("accepte un nom et un prénom, en retirant les espaces autour", () => {
    expect(parseProfile({ firstname: "  Clément ", lastname: " Hervouet  " })).toEqual({
      success: true,
      profile: { firstname: "Clément", lastname: "Hervouet" },
    });
  });

  it("garde les noms composés, apostrophes et espaces intérieurs", () => {
    expect(parseProfile({ firstname: "Jean-Marie", lastname: "d'Arc de La Tour" })).toEqual({
      success: true,
      profile: { firstname: "Jean-Marie", lastname: "d'Arc de La Tour" },
    });
  });

  it("normalise en NFC : un « é » décomposé devient un seul caractère", () => {
    const result = parseProfile({ firstname: "Cle\u0301ment", lastname: "Hervouet" });
    expect(result).toEqual({
      success: true,
      profile: { firstname: "Cl\u00e9ment", lastname: "Hervouet" },
    });
  });

  it("accepte exactement la longueur maximale", () => {
    const name = "x".repeat(PERSON_NAME_MAX);
    expect(parseProfile({ firstname: name, lastname: name }).success).toBe(true);
  });

  it("refuse des champs vides ou faits d'espaces, avec un code par champ", () => {
    expect(parseProfile({ firstname: "", lastname: "   " })).toEqual({
      success: false,
      issues: ["firstname.required", "lastname.required"],
    });
  });

  it("refuse des champs absents ou qui ne sont pas du texte", () => {
    expect(parseProfile({ firstname: null, lastname: 42 })).toEqual({
      success: false,
      issues: ["firstname.required", "lastname.required"],
    });
  });

  it("refuse un nom trop long", () => {
    const lastname = "x".repeat(PERSON_NAME_MAX + 1);
    expect(parseProfile({ firstname: "Clem", lastname })).toEqual({
      success: false,
      issues: ["lastname.too_long"],
    });
  });

  it("refuse les caractères de contrôle (saut de ligne, tabulation, NUL)", () => {
    for (const firstname of ["Cl\nem", "Cl\tem", "Cl\u0000em"]) {
      expect(parseProfile({ firstname, lastname: "Hervouet" })).toEqual({
        success: false,
        issues: ["firstname.invalid"],
      });
    }
  });
});

describe("parseProfileForm", () => {
  it("lit les champs firstname et lastname du formulaire", () => {
    expect(parseProfileForm(form({ firstname: "Clem", lastname: "Hervouet" }))).toEqual({
      success: true,
      profile: { firstname: "Clem", lastname: "Hervouet" },
    });
  });

  it("refuse un formulaire sans les champs", () => {
    expect(parseProfileForm(form({}))).toEqual({
      success: false,
      issues: ["firstname.required", "lastname.required"],
    });
  });
});
