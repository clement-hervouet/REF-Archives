/**
 * Totaux d'indemnités par mois (bloc 6). Pur : ni base, ni React. Le mois est celui du
 * match à Paris (§5.6) : un match le 01/11 à 00h30 heure de Paris (31/10 à 23h30 UTC)
 * compte en novembre.
 */
import { toParisIsoDate } from "@/lib/dates";
import type { CompensationAmount } from "./amount";

export type DatedCompensation = {
  /** Début du match indemnisé (instant UTC, colonne `compensation.starts_at`). */
  startsAt: Date;
  amount: CompensationAmount;
};

export type MonthlyTotal = {
  /** Mois `AAAA-MM`, à Paris. */
  month: string;
  gameCount: number;
  gameCents: number;
  mileageCents: number;
  totalCents: number;
};

/** Regroupe les indemnités par mois de Paris, du mois le plus récent au plus ancien. */
export function computeMonthlyTotals(items: readonly DatedCompensation[]): MonthlyTotal[] {
  const byMonth = new Map<string, MonthlyTotal>();
  for (const item of items) {
    const month = toParisIsoDate(item.startsAt).slice(0, 7);
    const total = byMonth.get(month) ?? {
      month,
      gameCount: 0,
      gameCents: 0,
      mileageCents: 0,
      totalCents: 0,
    };
    total.gameCount += 1;
    total.gameCents += item.amount.gameCents;
    total.mileageCents += item.amount.mileageCents;
    total.totalCents += item.amount.totalCents;
    byMonth.set(month, total);
  }
  // Format AAAA-MM : l'ordre des chaînes est l'ordre chronologique.
  return [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}
