import { describe, expect, it } from "vitest";
import { preparationFormSchema } from "./preparations";

const EMPTY_TEAM = {
  rank: "",
  wins: "",
  losses: "",
  players: "",
  coaches: "",
  alreadyRefereed: false,
};

const EMPTY_CREW = { placement: "", communication: "", management: "", table: "", contact: "" };

function input(overrides: Record<string, unknown> = {}) {
  return {
    teamCount: "",
    team1: EMPTY_TEAM,
    team2: EMPTY_TEAM,
    crew: EMPTY_CREW,
    observed: false,
    ...overrides,
  };
}

describe("preparationFormSchema", () => {
  it("accepte un classement complet et nettoie les textes", () => {
    const parsed = preparationFormSchema.parse(
      input({
        teamCount: "12",
        team1: {
          ...EMPTY_TEAM,
          rank: " 3 ",
          wins: "7",
          losses: "2",
          players: "  Le 8 provoque beaucoup.\r\nMeneur rapide.  ",
          alreadyRefereed: true,
        },
        crew: { ...EMPTY_CREW, contact: "Tolérance basse sur les écrans." },
        observed: true,
      }),
    );
    expect(parsed.teamCount).toBe(12);
    expect(parsed.team1).toEqual({
      rank: 3,
      wins: 7,
      losses: 2,
      players: "Le 8 provoque beaucoup.\nMeneur rapide.",
      coaches: null,
      alreadyRefereed: true,
    });
    expect(parsed.team2.rank).toBeNull();
    expect(parsed.crew.contact).toBe("Tolérance basse sur les écrans.");
    expect(parsed.crew.placement).toBeNull();
    expect(parsed.observed).toBe(true);
  });

  it("refuse une préparation vide, même avec les cases cochées", () => {
    const result = preparationFormSchema.safeParse(
      input({ team1: { ...EMPTY_TEAM, alreadyRefereed: true }, observed: true }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["empty_preparation"]);
  });

  it("accepte un seul nombre renseigné", () => {
    expect(
      preparationFormSchema.safeParse(input({ team2: { ...EMPTY_TEAM, losses: "0" } })).success,
    ).toBe(true);
  });

  it("accepte le seul nombre d'équipes de la poule", () => {
    expect(preparationFormSchema.safeParse(input({ teamCount: "12" })).success).toBe(true);
  });

  it("refuse une position au-delà du nombre d'équipes de la poule, équipe par équipe", () => {
    const result = preparationFormSchema.safeParse(
      input({
        teamCount: "12",
        team1: { ...EMPTY_TEAM, rank: "12" },
        team2: { ...EMPTY_TEAM, rank: "13" },
      }),
    );
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["team2", "rank"], message: "rank_above_count" }),
    ]);
  });

  it.each([
    ["rank", "0"],
    ["rank", "51"],
    ["wins", "100"],
    ["losses", "-1"],
    ["wins", "2.5"],
    ["rank", "abc"],
  ])("refuse %s = %s", (field, value) => {
    const result = preparationFormSchema.safeParse(
      input({ team1: { ...EMPTY_TEAM, players: "ok", [field]: value } }),
    );
    expect(result.error?.issues[0]?.path).toEqual(["team1", field]);
  });

  it.each(["1", "51"])("refuse un nombre d'équipes de %s", (value) => {
    const result = preparationFormSchema.safeParse(input({ teamCount: value }));
    expect(result.error?.issues[0]?.path).toEqual(["teamCount"]);
  });

  it("refuse un texte trop long ou avec un caractère de contrôle", () => {
    for (const text of ["a".repeat(4097), "bip\u0007"]) {
      const result = preparationFormSchema.safeParse(
        input({ crew: { ...EMPTY_CREW, table: text } }),
      );
      expect(result.error?.issues[0]?.path).toEqual(["crew", "table"]);
    }
  });
});
