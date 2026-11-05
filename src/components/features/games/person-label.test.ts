import { describe, expect, it } from "vitest";
import { personLabel } from "./person-label";

describe("personLabel", () => {
  it("affiche « Moi » pour l'utilisateur", () => {
    expect(personLabel({ isSelf: true, firstname: null, lastname: null })).toBe("Moi");
  });

  it("affiche prénom et nom, ou le nom seul", () => {
    expect(personLabel({ isSelf: false, firstname: "Alex", lastname: "Martin" })).toBe(
      "Alex Martin",
    );
    expect(personLabel({ firstname: null, lastname: "Durand" })).toBe("Durand");
  });
});
