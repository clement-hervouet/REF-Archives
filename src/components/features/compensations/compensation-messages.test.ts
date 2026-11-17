import { describe, expect, it } from "vitest";
import type { CompensationFormState } from "@/server/compensation/compensation-form";
import {
  celebrationMessages,
  gamesAmountText,
  compensationStatusMessage,
  fieldError,
} from "./compensation-messages";

describe("compensationStatusMessage", () => {
  it("n'affiche rien avant le premier envoi", () => {
    expect(compensationStatusMessage({ status: "idle" })).toBeNull();
  });

  it("annonce le montant après création", () => {
    expect(
      compensationStatusMessage({
        status: "created",
        amount: { gameCents: 4800, mileageCents: 1998, totalCents: 6798 },
        firstOfSeason: null,
        final: null,
      }),
    ).toEqual({
      tone: "success",
      text: "Indemnité enregistrée : 67,98 € (match 48,00 € + kilométrage 19,98 €).",
    });
  });

  it("explique chaque refus", () => {
    expect(compensationStatusMessage({ status: "invalid", fields: ["date"] })?.tone).toBe("error");
    expect(compensationStatusMessage({ status: "no_rate_at_date" })?.text).toContain(
      "aucun montant en vigueur",
    );
    expect(
      compensationStatusMessage({ status: "limit_reached", resource: "club" })?.text,
    ).toContain("clubs");
    expect(
      compensationStatusMessage({ status: "limit_reached", resource: "compensation" })?.text,
    ).toContain("indemnités");
    expect(compensationStatusMessage({ status: "not_found", field: "scaleId" })?.text).toContain(
      "n'existe plus",
    );
  });
});

describe("fieldError", () => {
  const invalid: CompensationFormState = {
    status: "invalid",
    fields: ["date", "team1", "team2.name", "venue.postalCode", "oneWayDistance"],
  };

  it("donne un message aux seuls champs en erreur", () => {
    expect(fieldError("date", invalid)).toContain("date valide");
    expect(fieldError("time", invalid)).toBeNull();
  });

  it("gère les champs d'équipe et d'adresse", () => {
    expect(fieldError("team1", invalid)).toContain("Choisissez un club");
    expect(fieldError("team2.name", invalid)).toContain("nom du club");
    expect(fieldError("venue.postalCode", invalid)).toContain("Code postal");
    expect(fieldError("oneWayDistance", invalid)).toContain("Distance");
  });

  it("signale aussi le champ d'un élément introuvable", () => {
    const notFound = { status: "not_found", field: "team2" } as const;
    expect(fieldError("team2", notFound)).toContain("Choisissez un club");
    expect(fieldError("team1", notFound)).toBeNull();
  });

  it("n'affiche aucune erreur de champ après un succès", () => {
    expect(
      fieldError("date", {
        status: "created",
        amount: { gameCents: 0, mileageCents: 0, totalCents: 0 },
        firstOfSeason: null,
        final: null,
      }),
    ).toBeNull();
  });
});

describe("celebrationMessages", () => {
  const amount = { gameCents: 3000, mileageCents: 0, totalCents: 3000 };
  const final = {
    category: "Regional",
    type: "Feminin",
    level: "U18",
    cup: true,
    plateau: false,
    department: "56",
  } as const;

  it("rien sans saison à fêter ni finale", () => {
    expect(celebrationMessages({ status: "idle" })).toEqual([]);
    expect(
      celebrationMessages({ status: "created", amount, firstOfSeason: null, final: null }),
    ).toEqual([]);
    expect(celebrationMessages({ status: "updated", amount, final: null })).toEqual([]);
  });

  it("félicite pour une finale, nommée d'après le lieu du match (§15.4.6)", () => {
    expect(celebrationMessages({ status: "updated", amount, final })).toEqual([
      "Félicitations pour cette sélection en finale CBU18F\u00a0!",
    ]);
    expect(
      celebrationMessages({
        status: "created",
        amount,
        firstOfSeason: null,
        final: { ...final, category: "Departemental", level: "Seniors", type: "Masculin" },
      }),
    ).toEqual(["Félicitations pour cette sélection en finale COUPE 56 SM\u00a0!"]);
  });

  it("garde les deux messages pour une première indemnité de saison en finale", () => {
    expect(celebrationMessages({ status: "created", amount, firstOfSeason: 2026, final })).toEqual([
      "Première indemnité de la saison : bon début de saison 2026-2027\u00a0!",
      "Félicitations pour cette sélection en finale CBU18F\u00a0!",
    ]);
  });
});

describe("gamesAmountText (§15.4.7)", () => {
  it("montant seul pour un match, détaillé pour un plateau", () => {
    expect(gamesAmountText(3000, 1)).toBe("30,00\u00a0€");
    expect(gamesAmountText(4500, 3)).toBe("45,00\u00a0€ (3 × 15,00\u00a0€)");
  });
});
