import { describe, expect, it } from "vitest";
import { previewCompensation } from "./preview";
import type { PreviewInput } from "./preview";

const RATES = [
  { effectiveFrom: "2026-01-01", gameAmountCents: 4500, centsPerKm: "40.00" },
  { effectiveFrom: "2026-09-01", gameAmountCents: 4800, centsPerKm: "42.50" },
];

function input(overrides: Partial<PreviewInput> = {}): PreviewInput {
  return {
    date: "2026-11-14",
    time: "19:00",
    category: "Regional",
    rates: RATES,
    oneWayDistance: "23",
    payerChoice: "",
    venue: { postalCode: "35000", country: null },
    ...overrides,
  };
}

describe("previewCompensation : montant", () => {
  it("calcule avec la ligne en vigueur à la date du match", () => {
    expect(previewCompensation(input()).amount).toEqual({
      status: "ok",
      // 48,00 € + 46 km × 0,425 € = 19,55 €
      amount: { gameCents: 4800, mileageCents: 1955, totalCents: 6755 },
      distanceM: 46_000,
      effectiveFrom: "2026-09-01",
    });
  });

  it("prend l'ancienne ligne pour un match antérieur à la nouvelle", () => {
    const amount = previewCompensation(input({ date: "2026-08-31" })).amount;
    expect(amount.status === "ok" && amount.effectiveFrom).toBe("2026-01-01");
  });

  it("signale l'absence de ligne à cette date", () => {
    expect(previewCompensation(input({ date: "2025-12-31" })).amount).toEqual({
      status: "no_rate",
    });
  });

  it("reste incomplet sans date, sans barème ou avec une distance invalide", () => {
    for (const overrides of [
      { date: "" },
      { rates: [] },
      { oneWayDistance: "" },
      { oneWayDistance: "12 km" },
    ]) {
      expect(previewCompensation(input(overrides)).amount).toEqual({ status: "incomplete" });
    }
  });
});

describe("previewCompensation : horaire", () => {
  it("convertit l'heure de Paris en instant UTC", () => {
    expect(previewCompensation(input()).startsAt?.toISOString()).toBe("2026-11-14T18:00:00.000Z");
  });

  it("renvoie null pour une heure manquante ou inexistante (passage à l'heure d'été)", () => {
    expect(previewCompensation(input({ time: "" })).startsAt).toBeNull();
    expect(previewCompensation(input({ date: "2026-03-29", time: "02:30" })).startsAt).toBeNull();
  });
});

describe("previewCompensation : organisme", () => {
  it("déduit l'organisme du niveau et de l'adresse en mode automatique", () => {
    expect(previewCompensation(input()).payer).toEqual({
      status: "known",
      payer: { kind: "league", league: "bretagne" },
      automatic: true,
    });
    expect(previewCompensation(input({ category: "Departemental" })).payer).toEqual({
      status: "known",
      payer: { kind: "committee", department: "35" },
      automatic: true,
    });
  });

  it("donne la Fédération pour un match national, même sans adresse", () => {
    expect(previewCompensation(input({ category: "National", venue: null })).payer).toEqual({
      status: "known",
      payer: { kind: "federation" },
      automatic: true,
    });
  });

  it("attend le niveau et l'adresse avant de déduire", () => {
    expect(previewCompensation(input({ category: null })).payer).toEqual({ status: "pending" });
    expect(previewCompensation(input({ venue: null })).payer).toEqual({ status: "pending" });
  });

  it("affiche un organisme inconnu pour une adresse à l'étranger", () => {
    expect(
      previewCompensation(input({ venue: { postalCode: "1000", country: "Belgique" } })).payer,
    ).toEqual({ status: "known", payer: null, automatic: true });
  });

  it("garde le choix explicite, sans déduction", () => {
    expect(previewCompensation(input({ payerChoice: "cd-56", category: null })).payer).toEqual({
      status: "known",
      payer: { kind: "committee", department: "56" },
      automatic: false,
    });
  });
});
