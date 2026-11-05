import { describe, expect, it } from "vitest";
import { officialsSummary } from "./officials-summary";

describe("officialsSummary", () => {
  it("liste les officiels dans l'ordre reçu, « Moi » pour l'utilisateur", () => {
    expect(
      officialsSummary([
        { slot: "referee1", isSelf: false, firstname: "Alex", lastname: "Martin" },
        { slot: "referee2", isSelf: true, firstname: null, lastname: null },
        { slot: "observer", isSelf: false, firstname: null, lastname: "Durand" },
      ]),
    ).toBe("Arbitre 1 : Alex Martin · Arbitre 2 : Moi · Observateur : Durand");
  });

  it("null sans officiel", () => {
    expect(officialsSummary([])).toBeNull();
  });
});
