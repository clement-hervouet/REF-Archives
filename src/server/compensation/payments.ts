/**
 * Paiement des indemnités (bloc 10) : résumé de ce qui reste dû, validation d'une
 * sélection, annulation d'un paiement. Ni Next.js ni authentification : l'action fournit
 * l'utilisateur de la session et le jour de Paris (§6.2). Dépendances injectées.
 */
import { payerKey, payerLabel, payerRank } from "@/lib/payers";
import type { Payer } from "@/lib/payers";
import { parseClearPaymentForm, parsePaymentForm } from "@/lib/schemas/payments";
import type { PaymentIssue } from "@/lib/schemas/payments";
import { computeCompensation } from "./amount";
import type { CompensationRate } from "./amount";

// ─── Résumé ─────────────────────────────────────────────────────────────────

export type UnpaidSummary<T> = {
  count: number;
  totalCents: number;
  /** La plus ancienne en attente (les lignes arrivent triées par date), ou `null`. */
  oldest: T | null;
};

/** Total et plus ancienne des indemnités en attente, triées de la plus ancienne à la plus récente. */
export function summarizeUnpaid<T extends CompensationRate & { distanceM: number }>(
  rows: readonly T[],
): UnpaidSummary<T> {
  let totalCents = 0;
  for (const row of rows) {
    totalCents += computeCompensation(row, row.distanceM).totalCents;
  }
  return { count: rows.length, totalCents, oldest: rows[0] ?? null };
}

export type PayerGroup<T> = {
  /** Clé stable (`cd-35`, `federation`, `unknown`). */
  key: string;
  /** « CD35 », « Ligue de Bretagne », « Fédération », « Organisme inconnu ». */
  label: string;
  rows: T[];
  totalCents: number;
};

/**
 * Regroupe des indemnités par organisme qui verse : comités, ligues, Fédération, inconnu ;
 * l'ordre des lignes (par date) est conservé dans chaque groupe.
 */
export function groupByPayer<
  T extends CompensationRate & { distanceM: number; payer: Payer | null },
>(rows: readonly T[]): PayerGroup<T>[] {
  const groups = new Map<string, PayerGroup<T> & { payer: Payer | null }>();
  for (const row of rows) {
    const key = row.payer === null ? "unknown" : payerKey(row.payer);
    const group = groups.get(key) ?? {
      key,
      label: payerLabel(row.payer),
      payer: row.payer,
      rows: [],
      totalCents: 0,
    };
    group.rows.push(row);
    group.totalCents += computeCompensation(row, row.distanceM).totalCents;
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => payerRank(a.payer) - payerRank(b.payer) || a.label.localeCompare(b.label, "fr"))
    .map(({ key, label, rows: groupRows, totalCents }) => ({
      key,
      label,
      rows: groupRows,
      totalCents,
    }));
}

// ─── Validation d'une sélection ─────────────────────────────────────────────

export type MarkPaidState =
  | { status: "idle" }
  | { status: "invalid"; issues: PaymentIssue[] }
  | { status: "marked"; count: number; paidOn: string }
  /** Rien n'a changé : déjà payées, supprimées ou introuvables entre-temps. */
  | { status: "unchanged" };

export type MarkPaidDeps = {
  markPaid: (input: {
    userId: string;
    compensationIds: readonly string[];
    paidOn: string;
  }) => Promise<number>;
};

export async function handleMarkPaid(
  deps: MarkPaidDeps,
  userId: string,
  formData: FormData,
  today: string,
): Promise<MarkPaidState> {
  const parsed = parsePaymentForm(formData, today);
  if (!parsed.success) {
    return { status: "invalid", issues: parsed.issues };
  }
  const count = await deps.markPaid({ userId, ...parsed.selection });
  return count === 0
    ? { status: "unchanged" }
    : { status: "marked", count, paidOn: parsed.selection.paidOn };
}

// ─── Annulation ─────────────────────────────────────────────────────────────

export type ClearPaymentState =
  | { status: "idle" }
  | { status: "cleared" }
  /** Identifiant mal formé, indemnité introuvable, d'un autre compte ou pas payée. */
  | { status: "not_found" };

export type ClearPaymentDeps = {
  clearPayment: (input: { userId: string; compensationId: string }) => Promise<boolean>;
};

export async function handleClearPayment(
  deps: ClearPaymentDeps,
  userId: string,
  formData: FormData,
): Promise<ClearPaymentState> {
  const compensationId = parseClearPaymentForm(formData);
  if (compensationId === null) {
    return { status: "not_found" };
  }
  return (await deps.clearPayment({ userId, compensationId }))
    ? { status: "cleared" }
    : { status: "not_found" };
}
