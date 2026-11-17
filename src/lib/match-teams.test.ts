import { describe, expect, it } from "vitest";
import { withTeams } from "./match-teams";

describe("withTeams", () => {
  it("place les deux équipes", () => {
    expect(withTeams("{team1} – {team2}", "BC Vannes", "US Quimper")).toBe(
      "BC Vannes – US Quimper",
    );
  });

  it("nomme le club organisateur d'un plateau (§15.4.7)", () => {
    expect(withTeams("Arbitrage : {team1} – {team2}", "BC Vannes", null)).toBe(
      "Arbitrage : Plateau chez BC Vannes",
    );
  });

  it("ne réinterprète pas les motifs spéciaux d'un nom de club", () => {
    expect(withTeams("{team1} – {team2}", "Club $&", null)).toBe("Plateau chez Club $&");
  });
});
