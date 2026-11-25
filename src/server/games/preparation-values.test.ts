import { describe, expect, it } from "vitest";
import { preparationFormSchema } from "@/lib/schemas/preparations";
import type { PreparationForm } from "@/lib/schemas/preparations";
import { mergePreparation, preparationInput, preparationValues } from "./preparation-values";

const TEAM = { rank: "", wins: "", losses: "", players: "", coaches: "", alreadyRefereed: false };

const BASE = preparationFormSchema.parse({
  teamCount: "12",
  team1: { ...TEAM, rank: "3", players: "Le 8 provoque" },
  team2: { ...TEAM, rank: "5" },
  crew: { placement: "Large", communication: "", management: "", table: "", contact: "" },
  observed: false,
});

/** Copie de `BASE` avec quelques champs changés. */
function changed(patch: (preparation: PreparationForm) => void): PreparationForm {
  const copy = structuredClone(BASE);
  patch(copy);
  return copy;
}

describe("preparationValues / preparationInput", () => {
  it("font l'aller-retour entre préparation et valeurs de formulaire", () => {
    const values = preparationValues(BASE);
    expect(values).toMatchObject({ teamCount: "12", team1Rank: "3", team2Wins: "", observed: "" });
    expect(preparationFormSchema.parse(preparationInput((name) => values[name] ?? ""))).toEqual(
      BASE,
    );
  });
});

describe("mergePreparation", () => {
  it("garde les champs modifiés ailleurs et écrit ceux modifiés ici", () => {
    const mine = changed((p) => {
      p.team1.wins = 7;
    });
    const current = changed((p) => {
      p.crew.table = "Table lente";
      p.observed = true;
    });
    expect(mergePreparation({ base: BASE, mine, current })).toEqual({
      status: "merged",
      preparation: changed((p) => {
        p.team1.wins = 7;
        p.crew.table = "Table lente";
        p.observed = true;
      }),
    });
  });

  it("signale un champ modifié des deux côtés, différemment", () => {
    const mine = changed((p) => {
      p.crew.placement = "Très large";
      p.team1.alreadyRefereed = true;
    });
    const current = changed((p) => {
      p.crew.placement = "Serré";
      p.team1.alreadyRefereed = true;
    });
    // Même case cochée des deux côtés : pas de conflit.
    expect(mergePreparation({ base: BASE, mine, current })).toEqual({
      status: "conflict",
      conflicts: ["placement"],
    });
  });

  it("ne voit pas de conflit quand la préparation n'a pas changé ailleurs", () => {
    const mine = changed((p) => {
      p.crew.placement = null;
      p.team2.coaches = "Calme";
    });
    expect(mergePreparation({ base: BASE, mine, current: BASE })).toEqual({
      status: "merged",
      preparation: mine,
    });
  });

  it("signale les champs modifiés ailleurs quand la fusion viole une règle", () => {
    // Ici la position passe à 10, ailleurs la poule passe à 8 équipes.
    const mine = changed((p) => {
      p.team1.rank = 10;
    });
    const current = changed((p) => {
      p.teamCount = 8;
    });
    expect(mergePreparation({ base: BASE, mine, current })).toEqual({
      status: "conflict",
      conflicts: ["teamCount"],
    });
  });

  it("signale une préparation vidée par la fusion", () => {
    const base = preparationFormSchema.parse({
      teamCount: "",
      team1: TEAM,
      team2: TEAM,
      crew: { placement: "Large", communication: "", management: "", table: "Lente", contact: "" },
      observed: false,
    });
    const mine = { ...base, crew: { ...base.crew, placement: null } };
    const current = { ...base, crew: { ...base.crew, table: null } };
    expect(mergePreparation({ base, mine, current })).toEqual({
      status: "conflict",
      conflicts: ["table"],
    });
  });
});
