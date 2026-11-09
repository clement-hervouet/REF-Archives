import { describe, expect, it } from "vitest";
import type { MonthlyTotal } from "@/server/compensation/monthly-totals";
import { matchCountLabel, monthPaymentLabel } from "./season-labels";

function total(gameCount: number, pendingCount: number, upcomingCount: number): MonthlyTotal {
  return {
    month: "2026-11",
    gameCount,
    gameCents: 0,
    mileageCents: 0,
    totalCents: 0,
    paidCents: 0,
    pendingCount,
    pendingCents: 0,
    upcomingCount,
    upcomingCents: 0,
  };
}

describe("matchCountLabel", () => {
  it("accorde le nombre de matchs", () => {
    expect(matchCountLabel(0)).toBe("Aucun match");
    expect(matchCountLabel(1)).toBe("1 match");
    expect(matchCountLabel(4)).toBe("4 matchs");
  });
});

describe("monthPaymentLabel", () => {
  it("met en avant ce qui est en attente", () => {
    expect(monthPaymentLabel(total(3, 1, 1))).toBe("1 en attente");
    expect(monthPaymentLabel(total(3, 2, 0))).toBe("2 en attente");
  });

  it("distingue un mois à venir, partiellement à venir, tout payé", () => {
    expect(monthPaymentLabel(total(2, 0, 2))).toBe("À venir");
    expect(monthPaymentLabel(total(3, 0, 1))).toBe("Payé, 1 à venir");
    expect(monthPaymentLabel(total(3, 0, 0))).toBe("Tout payé");
  });
});
