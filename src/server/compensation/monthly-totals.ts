/**
 * Totaux d'indemnités par mois (blocs 6 et 10). Pur : ni base, ni React. Le mois est celui
 * du match à Paris (§5.6) : un match le 01/11 à 00h30 heure de Paris (31/10 à 23h30 UTC)
 * compte en novembre.
 *
 * Bloc 10 : chaque total sépare ce qui est payé, en attente (match joué, pas payé) et à
 * venir (match pas encore joué, donc pas encore dû).
 */
import { toParisIsoDate } from "@/lib/dates";
import { payerKey, payerLabel, payerRank } from "@/lib/payers";
import type { Payer } from "@/lib/payers";
import type { CompensationAmount } from "./amount";

export type PaymentStatus = "paid" | "pending" | "upcoming";

/** État de paiement d'une indemnité à l'instant `now`. */
export function paymentStatus(startsAt: Date, paidOn: string | null, now: Date): PaymentStatus {
  if (paidOn !== null) {
    return "paid";
  }
  return startsAt.getTime() < now.getTime() ? "pending" : "upcoming";
}

export type DatedCompensation = {
  /** Début du match indemnisé (instant UTC, colonne `compensation.starts_at`). */
  startsAt: Date;
  amount: CompensationAmount;
  status: PaymentStatus;
};

export type MonthlyTotal = {
  /** Mois `AAAA-MM`, à Paris. */
  month: string;
  gameCount: number;
  gameCents: number;
  mileageCents: number;
  totalCents: number;
  paidCents: number;
  pendingCount: number;
  pendingCents: number;
  upcomingCount: number;
  upcomingCents: number;
};

function emptyTotal(month: string): MonthlyTotal {
  return {
    month,
    gameCount: 0,
    gameCents: 0,
    mileageCents: 0,
    totalCents: 0,
    paidCents: 0,
    pendingCount: 0,
    pendingCents: 0,
    upcomingCount: 0,
    upcomingCents: 0,
  };
}

function add(total: MonthlyTotal, item: DatedCompensation): void {
  total.gameCount += 1;
  total.gameCents += item.amount.gameCents;
  total.mileageCents += item.amount.mileageCents;
  total.totalCents += item.amount.totalCents;
  if (item.status === "paid") {
    total.paidCents += item.amount.totalCents;
  } else if (item.status === "pending") {
    total.pendingCount += 1;
    total.pendingCents += item.amount.totalCents;
  } else {
    total.upcomingCount += 1;
    total.upcomingCents += item.amount.totalCents;
  }
}

/** Regroupe les indemnités par mois de Paris, du mois le plus récent au plus ancien. */
export function computeMonthlyTotals(items: readonly DatedCompensation[]): MonthlyTotal[] {
  const byMonth = new Map<string, MonthlyTotal>();
  for (const item of items) {
    const month = toParisIsoDate(item.startsAt).slice(0, 7);
    const total = byMonth.get(month) ?? emptyTotal(month);
    add(total, item);
    byMonth.set(month, total);
  }
  // Format AAAA-MM : l'ordre des chaînes est l'ordre chronologique.
  return [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}

/** Somme de plusieurs totaux (ex. une saison), sous le libellé `label`. */
export function sumTotals(label: string, totals: readonly MonthlyTotal[]): MonthlyTotal {
  const sum = emptyTotal(label);
  for (const total of totals) {
    sum.gameCount += total.gameCount;
    sum.gameCents += total.gameCents;
    sum.mileageCents += total.mileageCents;
    sum.totalCents += total.totalCents;
    sum.paidCents += total.paidCents;
    sum.pendingCount += total.pendingCount;
    sum.pendingCents += total.pendingCents;
    sum.upcomingCount += total.upcomingCount;
    sum.upcomingCents += total.upcomingCents;
  }
  return sum;
}

// ─── Par organisme (bloc 10) ────────────────────────────────────────────────

export type PayerTotal = Omit<MonthlyTotal, "month"> & {
  /** Clé stable (`cd-35`, `ligue-bretagne`, `federation`, `unknown`), pour les listes. */
  key: string;
  payer: Payer | null;
  /** « CD35 », « Ligue de Bretagne », « Fédération », « Organisme inconnu ». */
  label: string;
};

function withoutMonth(total: MonthlyTotal): Omit<MonthlyTotal, "month"> {
  return {
    gameCount: total.gameCount,
    gameCents: total.gameCents,
    mileageCents: total.mileageCents,
    totalCents: total.totalCents,
    paidCents: total.paidCents,
    pendingCount: total.pendingCount,
    pendingCents: total.pendingCents,
    upcomingCount: total.upcomingCount,
    upcomingCents: total.upcomingCents,
  };
}

/**
 * Regroupe des indemnités par organisme qui verse : comités, puis ligues, puis Fédération,
 * puis inconnu ; dans chaque groupe, par libellé.
 */
export function computePayerTotals(
  items: readonly (DatedCompensation & { payer: Payer | null })[],
): PayerTotal[] {
  const byPayer = new Map<string, { payer: Payer | null; total: MonthlyTotal }>();
  for (const item of items) {
    const key = item.payer === null ? "unknown" : payerKey(item.payer);
    const entry = byPayer.get(key) ?? { payer: item.payer, total: emptyTotal(key) };
    add(entry.total, item);
    byPayer.set(key, entry);
  }
  return [...byPayer.entries()]
    .map(([key, { payer, total }]) => {
      return { ...withoutMonth(total), key, payer, label: payerLabel(payer) };
    })
    .sort(
      (a, b) => payerRank(a.payer) - payerRank(b.payer) || a.label.localeCompare(b.label, "fr"),
    );
}
