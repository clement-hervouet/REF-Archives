/**
 * Récapitulatif en direct du formulaire d'indemnité (bloc 10) : horaire, organisme qui
 * versera, montant avec la ligne de barème en vigueur à la date. Pur et sans Zod : il
 * tourne dans le navigateur à chaque saisie. Ce n'est qu'un aperçu : le serveur refait
 * tout le calcul à l'enregistrement (§6.3), avec les mêmes fonctions.
 */
import { isIsoDate } from "@/lib/dates";
import { parseOneWayDistance } from "@/lib/distance";
import { isTimeOfDay, parisLocalToUtc } from "@/lib/paris-time";
import { deducePayer, departmentFromPostalCode, parsePayerKey } from "@/lib/payers";
import type { Payer, PayerCategory } from "@/lib/payers";
import { findEffectiveRate } from "@/server/scales/effective-rate";
import { computeCompensation } from "./amount";
import type { CompensationAmount } from "./amount";

type PreviewRate = { effectiveFrom: string; gameAmountCents: number; centsPerKm: string };

export type PreviewInput = {
  date: string;
  time: string;
  /** Niveau choisi, ou `null`. */
  category: PayerCategory | null;
  /** Lignes du barème choisi (vide si aucun barème). */
  rates: readonly PreviewRate[];
  oneWayDistance: string;
  /** Valeur de la liste « Organisme » : vide = automatique. */
  payerChoice: string;
  /** Adresse du match retenue (club de l'équipe 1 ou exception), ou `null` si pas encore connue. */
  venue: { postalCode: string; country: string | null } | null;
};

type PayerPreview =
  /** Pas encore déterminable : niveau ou adresse manquants. */
  { status: "pending" } | { status: "known"; payer: Payer | null; automatic: boolean };

type AmountPreview =
  | { status: "incomplete" }
  /** Le barème n'a aucune ligne à la date du match : l'enregistrement serait refusé. */
  | { status: "no_rate" }
  | {
      status: "ok";
      amount: CompensationAmount;
      distanceM: number;
      /** Date d'application de la ligne retenue. */
      effectiveFrom: string;
    };

export type CompensationPreview = {
  /** Début du match (UTC), ou `null` si la date ou l'heure manque ou n'existe pas. */
  startsAt: Date | null;
  payer: PayerPreview;
  amount: AmountPreview;
};

function previewStartsAt(date: string, time: string): Date | null {
  if (!isIsoDate(date) || !isTimeOfDay(time)) {
    return null;
  }
  try {
    return parisLocalToUtc(date, time);
  } catch {
    // Heure qui n'existe pas ce jour-là (passage à l'heure d'été) : le serveur la refusera.
    return null;
  }
}

function previewPayer(input: PreviewInput): PayerPreview {
  if (input.payerChoice !== "") {
    return { status: "known", payer: parsePayerKey(input.payerChoice), automatic: false };
  }
  if (input.category === null) {
    return { status: "pending" };
  }
  if (input.category === "National" || input.category === "Pro") {
    return { status: "known", payer: deducePayer(input.category, null), automatic: true };
  }
  if (input.venue === null) {
    return { status: "pending" };
  }
  const department = departmentFromPostalCode(input.venue.postalCode, input.venue.country);
  return { status: "known", payer: deducePayer(input.category, department), automatic: true };
}

function previewAmount(input: PreviewInput): AmountPreview {
  const distanceM = parseOneWayDistance(input.oneWayDistance);
  if (!isIsoDate(input.date) || input.rates.length === 0 || distanceM === null) {
    return { status: "incomplete" };
  }
  const rate = findEffectiveRate(input.rates, input.date);
  if (rate === null) {
    return { status: "no_rate" };
  }
  return {
    status: "ok",
    amount: computeCompensation(rate, distanceM),
    distanceM,
    effectiveFrom: rate.effectiveFrom,
  };
}

export function previewCompensation(input: PreviewInput): CompensationPreview {
  return {
    startsAt: previewStartsAt(input.date, input.time),
    payer: previewPayer(input),
    amount: previewAmount(input),
  };
}
