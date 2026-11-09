import { describe, expect, it } from "vitest";
import type { CompensationFormState } from "@/server/compensation/compensation-form";
import { compensationStatusMessage, fieldError } from "./compensation-messages";

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
      }),
    ).toBeNull();
  });
});
