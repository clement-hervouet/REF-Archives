/**
 * Formatage pour l'affichage. Les dates sont stockées en UTC et affichées en
 * Europe/Paris (§5.6), quel que soit le fuseau du serveur ou du navigateur.
 * Les montants sont formatés à partir d'entiers exacts, sans passer par un float.
 */
import { assertIsoDate } from "./dates";
import { ValidationError } from "./errors";

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

// Uniquement pour les séparateurs de milliers de la partie entière.
const integerFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Espace insécable avant le symbole, comme le fait Intl en français. */
const NBSP = "\u00a0";

/** Date et heure courtes, ex. « 01/11/2026 11:00 ». */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

/** Date calendaire `AAAA-MM-JJ` (colonne `date`) affichée « JJ/MM/AAAA », sans fuseau. */
export function formatIsoDate(isoDate: string): string {
  assertIsoDate(isoDate);
  const [year = "", month = "", day = ""] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Montant en centimes, ex. 480050 → « 4 800,50 € ». */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new ValidationError("invalid_cents");
  }
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const euros = integerFormat.format(Math.floor(absolute / 100));
  const rest = String(absolute % 100).padStart(2, "0");
  return `${sign}${euros},${rest}${NBSP}€`;
}

const CENTS_PER_KM_PATTERN = /^(\d{1,4})(?:\.(\d{1,2}))?$/;

/**
 * Taux en centimes par km (chaîne `numeric`, ex. `"42.50"`) affiché en euros par km,
 * avec 2 à 4 décimales : « 0,40 €/km », « 0,425 €/km ».
 */
export function formatCentsPerKm(centsPerKm: string): string {
  const match = CENTS_PER_KM_PATTERN.exec(centsPerKm);
  if (match === null) {
    throw new ValidationError("invalid_cents_per_km");
  }
  // Dix-millièmes d'euro : entier exact.
  const tenThousandths = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  const euros = Math.floor(tenThousandths / 10_000);
  const fraction = String(tenThousandths % 10_000)
    .padStart(4, "0")
    .replace(/0{1,2}$/, "");
  return `${String(euros)},${fraction}${NBSP}€/km`;
}