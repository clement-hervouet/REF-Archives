import { describe, expect, it } from "vitest";
import {
  preparationFieldError,
  preparationStatusMessage,
  standingText,
} from "./preparation-messages";

describe("preparationStatusMessage", () => {
  it("distingue une préparation vide d'un champ invalide", () => {
    expect(preparationStatusMessage({ status: "invalid", fields: {}, empty: true })?.text).toBe(
      "Renseignez au moins un champ (les cases seules ne suffisent pas).",
    );
    expect(
      preparationStatusMessage({
        status: "invalid",
        fields: { team1Rank: "invalid" },
        empty: false,
      })?.tone,
    ).toBe("error");
    expect(preparationStatusMessage({ status: "saved" })).toEqual({
      tone: "success",
      text: "Préparation enregistrée.",
    });
    expect(preparationStatusMessage({ status: "idle" })).toBeNull();
  });
});

describe("preparationFieldError", () => {
  const state = {
    status: "invalid" as const,
    fields: {
      team1Rank: "invalid" as const,
      team2Rank: "rank_above_count" as const,
      teamCount: "invalid" as const,
      team2Losses: "invalid" as const,
      table: "invalid" as const,
    },
    empty: false,
  };

  it("donne le message propre à chaque champ", () => {
    expect(preparationFieldError("team1Rank", state)).toBe("Position de 1 à 50.");
    expect(preparationFieldError("team2Rank", state)).toBe(
      "La position dépasse le nombre d'équipes.",
    );
    expect(preparationFieldError("teamCount", state)).toBe("Nombre d'équipes de 2 à 50.");
    expect(preparationFieldError("team2Losses", state)).toBe("Nombre de 0 à 99.");
    expect(preparationFieldError("table", state)).toContain("Texte trop long");
    expect(preparationFieldError("placement", state)).toBeNull();
    expect(preparationFieldError("team1Rank", { status: "saved" })).toBeNull();
  });
});

describe("standingText", () => {
  it("abrège le classement renseigné", () => {
    expect(standingText({ rank: 3, wins: 7, losses: 2 }, 12)).toBe("3e sur 12, 7 V – 2 D");
    expect(standingText({ rank: 1, wins: null, losses: null }, null)).toBe("1er");
    expect(standingText({ rank: null, wins: 4, losses: null }, 10)).toBe("4 V – 0 D");
    expect(standingText({ rank: null, wins: null, losses: null }, 10)).toBeNull();
  });
});
