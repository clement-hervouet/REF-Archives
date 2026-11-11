/**
 * Validation du paiement d'indemnités (bloc 10, §6.3) : sélection libre d'indemnités et
 * date du paiement. Les identifiants viennent du formulaire : ils sont validés ici puis
 * filtrés par propriétaire dans la requête (§6.2).
 */
import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

/** Au plus 500 indemnités par validation : borne la taille de la requête. */
export const MAX_PAYMENT_SELECTION = 500;

/** Aucune date de paiement antérieure (même borne que la contrainte en base). */
const MIN_PAYMENT_DATE = "2000-01-01";

export type PaymentIssue =
  "no_selection" | "too_many" | "invalid_selection" | "invalid_date" | "future_date";

type PaymentSelection = {
  compensationIds: string[];
  /** Jour du paiement, `AAAA-MM-JJ` (Paris). */
  paidOn: string;
};

export type PaymentParseResult =
  { success: true; selection: PaymentSelection } | { success: false; issues: PaymentIssue[] };

const uuidSchema = z.uuid();

type Parsed<T> = { ok: true; value: T } | { ok: false; issue: PaymentIssue };

function parseIds(values: FormDataEntryValue[]): Parsed<string[]> {
  if (values.length === 0) {
    return { ok: false, issue: "no_selection" };
  }
  // Doublons retirés AVANT la borne : cocher deux fois la même ligne ne compte qu'une fois.
  const unique = [...new Set(values)];
  if (unique.length > MAX_PAYMENT_SELECTION) {
    return { ok: false, issue: "too_many" };
  }
  const ids: string[] = [];
  for (const value of unique) {
    if (typeof value !== "string" || !uuidSchema.safeParse(value).success) {
      return { ok: false, issue: "invalid_selection" };
    }
    ids.push(value);
  }
  return { ok: true, value: ids };
}

function parseDate(value: FormDataEntryValue | null, today: string): Parsed<string> {
  if (typeof value !== "string" || !isIsoDate(value) || value < MIN_PAYMENT_DATE) {
    return { ok: false, issue: "invalid_date" };
  }
  // Dates ISO : la comparaison de chaînes suit l'ordre du calendrier.
  return value > today ? { ok: false, issue: "future_date" } : { ok: true, value };
}

/**
 * Lit le formulaire : cases `compensationId` (plusieurs) et champ `paidOn`.
 * `today` est le jour de Paris côté serveur, jamais une valeur du client.
 */
export function parsePaymentForm(formData: FormData, today: string): PaymentParseResult {
  const ids = parseIds(formData.getAll("compensationId"));
  const paidOn = parseDate(formData.get("paidOn"), today);
  if (ids.ok && paidOn.ok) {
    return { success: true, selection: { compensationIds: ids.value, paidOn: paidOn.value } };
  }
  const issues: PaymentIssue[] = [];
  if (!ids.ok) {
    issues.push(ids.issue);
  }
  if (!paidOn.ok) {
    issues.push(paidOn.issue);
  }
  return { success: false, issues };
}

/** Identifiant d'une indemnité dont on annule le paiement, ou `null` s'il est mal formé. */
export function parseClearPaymentForm(formData: FormData): string | null {
  const value = formData.get("compensationId");
  return typeof value === "string" && uuidSchema.safeParse(value).success ? value : null;
}
