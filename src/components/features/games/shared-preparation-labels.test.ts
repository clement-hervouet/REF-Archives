import { describe, expect, it } from "vitest";
import { firstNameOf, fullNameOf, modifiedByText, namesList } from "./shared-preparation-labels";

describe("libellés de la préparation partagée", () => {
  it("affiche le prénom, ou le nom à défaut", () => {
    expect(firstNameOf({ firstname: "Julien", lastname: "Dupont" })).toBe("Julien");
    expect(firstNameOf({ firstname: null, lastname: "Dupont" })).toBe("Dupont");
    expect(fullNameOf({ firstname: "Julien", lastname: "Dupont" })).toBe("Julien Dupont");
    expect(namesList(["Julien", "Léa"])).toBe("Julien, Léa");
  });

  it("dit qui a modifié en dernier : vous, un arbitre du partage, ou rien", () => {
    const people = new Map([["u2", "Julien"]]);
    const updatedAt = new Date("2026-11-25T19:30:00Z");
    expect(modifiedByText({ updatedBy: "u1", updatedAt }, "u1", people)).toMatch(
      /^Dernière modification par vous le /,
    );
    expect(modifiedByText({ updatedBy: "u2", updatedAt }, "u1", people)).toMatch(/par Julien le /);
    expect(modifiedByText({ updatedBy: "u3", updatedAt }, "u1", people)).toBeNull();
    expect(modifiedByText({ updatedBy: null, updatedAt }, "u1", people)).toBeNull();
  });
});
