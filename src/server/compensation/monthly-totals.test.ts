import { describe, expect, it } from "vitest";
import {
  computeMonthlyTotals,
  computePayerTotals,
  paymentStatus,
  sumTotals,
} from "./monthly-totals";
import type { PaymentStatus } from "./monthly-totals";

function item(
  startsAt: string,
  gameCents: number,
  mileageCents: number,
  status: PaymentStatus = "paid",
) {
  return {
    startsAt: new Date(startsAt),
    amount: { gameCents, mileageCents, totalCents: gameCents + mileageCents },
    status,
  };
}

describe("paymentStatus", () => {
  const now = new Date("2026-11-06T12:00:00Z");

  it("est « payée » dès qu'une date de paiement existe, même pour un match à venir", () => {
    expect(paymentStatus(new Date("2026-10-10T18:00:00Z"), "2026-10-20", now)).toBe("paid");
    expect(paymentStatus(new Date("2026-12-10T18:00:00Z"), "2026-11-01", now)).toBe("paid");
  });

  it("est « en attente » pour un match déjà commencé et non payé", () => {
    expect(paymentStatus(new Date("2026-11-06T11:59:59Z"), null, now)).toBe("pending");
  });

  it("est « à venir » pour un match pas encore commencé", () => {
    expect(paymentStatus(new Date("2026-11-06T12:00:00Z"), null, now)).toBe("upcoming");
  });
});

describe("computeMonthlyTotals", () => {
  it("renvoie une liste vide sans indemnité", () => {
    expect(computeMonthlyTotals([])).toEqual([]);
  });

  it("additionne les indemnités d'un même mois et sépare payé, en attente, à venir", () => {
    expect(
      computeMonthlyTotals([
        item("2026-11-01T18:00:00Z", 4800, 1998, "paid"),
        item("2026-11-04T19:00:00Z", 3000, 960, "pending"),
        item("2026-11-21T19:00:00Z", 3000, 960, "upcoming"),
      ]),
    ).toEqual([
      {
        month: "2026-11",
        gameCount: 3,
        gameCents: 10_800,
        mileageCents: 3918,
        totalCents: 14_718,
        paidCents: 6798,
        pendingCount: 1,
        pendingCents: 3960,
        upcomingCount: 1,
        upcomingCents: 3960,
      },
    ]);
  });

  it("trie du mois le plus récent au plus ancien, toutes années confondues", () => {
    const months = computeMonthlyTotals([
      item("2025-12-06T18:00:00Z", 3000, 0),
      item("2026-11-14T18:00:00Z", 3000, 0),
      item("2026-01-10T18:00:00Z", 3000, 0),
    ]).map((total) => total.month);
    expect(months).toEqual(["2026-11", "2026-01", "2025-12"]);
  });

  it("classe un match selon le mois à Paris, pas en UTC", () => {
    // 31/10/2026 23:30 UTC = 01/11/2026 00:30 à Paris (heure d'hiver).
    const [total] = computeMonthlyTotals([item("2026-10-31T23:30:00Z", 3000, 0)]);
    expect(total?.month).toBe("2026-11");
  });

  it("garde un match tardif dans son mois à Paris", () => {
    // 30/09/2026 21:45 UTC = 30/09/2026 23:45 à Paris (heure d'été).
    const [total] = computeMonthlyTotals([item("2026-09-30T21:45:00Z", 3000, 0)]);
    expect(total?.month).toBe("2026-09");
  });
});

describe("sumTotals", () => {
  it("additionne chaque colonne sous un libellé", () => {
    const totals = computeMonthlyTotals([
      item("2026-10-10T18:00:00Z", 3000, 960, "paid"),
      item("2026-11-04T19:00:00Z", 4800, 1955, "pending"),
    ]);
    expect(sumTotals("2026", totals)).toEqual({
      month: "2026",
      gameCount: 2,
      gameCents: 7800,
      mileageCents: 2915,
      totalCents: 10_715,
      paidCents: 3960,
      pendingCount: 1,
      pendingCents: 6755,
      upcomingCount: 0,
      upcomingCents: 0,
    });
  });

  it("renvoie des zéros sans total", () => {
    expect(sumTotals("2026", []).totalCents).toBe(0);
  });
});

describe("computePayerTotals", () => {
  const cd35 = { kind: "committee", department: "35" } as const;
  const cd22 = { kind: "committee", department: "22" } as const;
  const bzh = { kind: "league", league: "bretagne" } as const;
  const ffbb = { kind: "federation" } as const;

  it("regroupe par organisme et sépare payé, en attente, à venir", () => {
    const totals = computePayerTotals([
      { ...item("2026-10-10T18:00:00Z", 3000, 960, "paid"), payer: cd35 },
      { ...item("2026-10-17T18:00:00Z", 3000, 960, "pending"), payer: cd35 },
      { ...item("2026-11-14T18:00:00Z", 4800, 1955, "upcoming"), payer: bzh },
    ]);
    expect(totals.map((total) => [total.label, total.gameCount, total.totalCents])).toEqual([
      ["CD35", 2, 7920],
      ["Ligue de Bretagne", 1, 6755],
    ]);
    expect(totals[0]).toMatchObject({ key: "cd-35", paidCents: 3960, pendingCount: 1 });
    expect(totals[0]).not.toHaveProperty("month");
  });

  it("classe comités (par numéro), ligues, Fédération, puis inconnu", () => {
    const labels = computePayerTotals([
      { ...item("2026-10-10T18:00:00Z", 1, 0), payer: null },
      { ...item("2026-10-10T18:00:00Z", 1, 0), payer: ffbb },
      { ...item("2026-10-10T18:00:00Z", 1, 0), payer: bzh },
      { ...item("2026-10-10T18:00:00Z", 1, 0), payer: cd35 },
      { ...item("2026-10-10T18:00:00Z", 1, 0), payer: cd22 },
    ]).map((total) => total.label);
    expect(labels).toEqual([
      "CD22",
      "CD35",
      "Ligue de Bretagne",
      "Fédération",
      "Organisme inconnu",
    ]);
  });

  it("renvoie une liste vide sans indemnité", () => {
    expect(computePayerTotals([])).toEqual([]);
  });
});
