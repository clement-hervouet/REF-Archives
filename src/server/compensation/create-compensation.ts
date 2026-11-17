/**
 * Enregistrement d'une indemnité autonome (bloc 6) : création et modification, chacune
 * en une seule transaction. Clubs et adresses créés à la volée, équipes retrouvées ou
 * créées, ligne de barème en vigueur à la date du match, puis l'indemnité. Une
 * modification est recopiée sur le match complet lié, s'il existe (bloc 9, §3.11).
 *
 * Ni Next.js ni authentification ici : la Server Action vérifie l'utilisateur et valide
 * le formulaire (`compensationFormSchema`) AVANT d'appeler ce service. Tout refus annule
 * la transaction entière : aucun club ni adresse orphelin ne reste en base.
 */
import { toParisIsoDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import type { CompensationForm } from "@/lib/schemas/compensations";
import { seasonOf, seasonRange } from "@/lib/seasons";
import type { CompensationField } from "@/lib/compensation-form-fields";
import { countCompensationsInRange, findCupFinal, listApplicableRates } from "../db/compensations";
import type { CupFinal } from "../db/compensations";
import type { ApplicableRate } from "../db/compensations";
import {
  insertCompensation,
  lockCompensation,
  updateCompensation as updateCompensationRow,
} from "../db/compensation-writes";
import type { NewCompensation } from "../db/compensation-writes";
import { syncGameFromCompensation } from "../db/game-writes";
import type { CupRound } from "../db/divisions";
import type { Queryable, Transaction } from "../db/users";
import { findEffectiveRate } from "../scales/effective-rate";
import { computeCompensation } from "./amount";
import type { CompensationAmount } from "./amount";
import { checkMatchLevel } from "./match-level";
import { resolveMatchInfo } from "./resolve-match";

export type CompensationDeps = { transaction: Transaction };

/**
 * Ressource introuvable (ou pas à l'utilisateur) : un champ du formulaire, ou
 * l'indemnité elle-même pour une modification.
 */
type NotFoundField = "divisionId" | "scaleId" | "team1" | "team2" | "venue" | "compensation";

export type CreateCompensationRejection =
  | { status: "not_found"; field: NotFoundField }
  /**
   * Champ obligatoire pour ce niveau (tour de coupe §15.4.6 ; équipe 2 hors plateau, nombre
   * de matchs d'un plateau §15.4.7) : vérifié avec le niveau, en base.
   */
  | { status: "invalid"; fields: CompensationField[] }
  /** Le barème choisi n'a aucune ligne en vigueur à la date du match. */
  | { status: "no_rate_at_date" }
  | { status: "limit_reached"; resource: "club" | "compensation" };

export type CreateCompensationResult =
  | {
      status: "created";
      compensationId: string;
      amount: CompensationAmount;
      /**
       * Année de début de la saison FFBB (`2026` = 2026-2027) si c'est la première
       * indemnité de cette saison pour l'utilisateur (confettis, bloc 12d), sinon `null`.
       */
      firstOfSeason: number | null;
      /** Finale de coupe tout juste enregistrée (confettis, §15.4.6), sinon `null`. */
      final: CupFinal | null;
    }
  | CreateCompensationRejection;

export type UpdateCompensationResult =
  | { status: "updated"; amount: CompensationAmount; final: CupFinal | null }
  | CreateCompensationRejection;

/** Refus levé dans la transaction pour la faire annuler ; jamais visible hors de ce module. */
class CompensationRejected extends AppError {
  override readonly name = "CompensationRejected";

  constructor(readonly rejection: CreateCompensationRejection) {
    super(rejection.status);
  }
}

function reject(rejection: CreateCompensationRejection): never {
  throw new CompensationRejected(rejection);
}

type ResolvedCompensation = {
  rate: ApplicableRate;
  row: Omit<NewCompensation, "userId">;
};

/**
 * Tout ce que l'indemnité référence, résolu et vérifié : d'abord ce qui peut refuser
 * sans rien écrire (niveau, barème), puis le match (`resolve-match.ts`, créations à la
 * volée).
 */
async function resolveCompensation(
  db: Queryable,
  userId: string,
  form: CompensationForm,
): Promise<ResolvedCompensation> {
  const level = await checkMatchLevel(db, form);
  if (level.status === "not_found") {
    reject({ status: "not_found", field: "divisionId" });
  }
  if (level.status === "invalid") {
    reject({ status: "invalid", fields: level.fields });
  }
  const rates = await listApplicableRates(db, { scaleId: form.scaleId, userId });
  if (rates === null) {
    reject({ status: "not_found", field: "scaleId" });
  }
  // Le barème en vigueur se choisit au jour du match à Paris (§5.1, §5.6).
  const rate = findEffectiveRate(rates, toParisIsoDate(form.startsAt));
  if (rate === null) {
    reject({ status: "no_rate_at_date" });
  }

  const match = await resolveMatchInfo(
    db,
    userId,
    { ...form, cupRound: level.cupRound, team2: level.team2 },
    reject,
  );

  return {
    rate,
    row: {
      ...match,
      scaleRateId: rate.id,
      distanceM: form.distanceM,
      payer: form.payer,
      // Pas de doublé sur un plateau (§15.4.7) : une case envoyée quand même est ignorée.
      travelShared: level.plateau ? false : form.travelShared,
      gameCount: level.gameCount,
      plateauGameCents: level.plateauGameCents,
    },
  };
}

/**
 * Montant de l'indemnité enregistrée : 1 match au montant du barème hors plateau ; pour un
 * plateau (§15.4.7), le montant par match saisi × le nombre de matchs (barème : taux km).
 */
function amountOf(rate: ApplicableRate, row: ResolvedCompensation["row"]): CompensationAmount {
  return computeCompensation(
    { ...rate, gameAmountCents: row.plateauGameCents ?? rate.gameAmountCents },
    { ...row, gameCount: row.gameCount ?? 1 },
  );
}

/**
 * Finale à fêter : l'indemnité enregistrée est une finale de coupe qui ne l'était pas
 * avant (`previousRound`, `null` à la création). Modifier une finale déjà enregistrée ne
 * relance pas les confettis.
 */
async function finalToCelebrate(
  db: Queryable,
  userId: string,
  row: ResolvedCompensation["row"],
  previousRound: CupRound | null,
): Promise<CupFinal | null> {
  if (row.cupRound !== "F" || previousRound === "F") {
    return null;
  }
  return findCupFinal(db, { divisionId: row.divisionId, addressId: row.addressId, userId });
}

/** Exécute `action` dans une transaction et transforme un refus en résultat. */
async function runRejectable<T>(
  deps: CompensationDeps,
  action: (db: Queryable) => Promise<T>,
): Promise<T | CreateCompensationRejection> {
  try {
    return await deps.transaction(action);
  } catch (error: unknown) {
    if (error instanceof CompensationRejected) {
      return error.rejection;
    }
    throw error;
  }
}

/**
 * Saison FFBB du match si l'indemnité qui vient d'être insérée (dans la même transaction)
 * est la seule de cette saison, sinon `null`. La saison se lit au jour du match à Paris.
 * Deux saisies simultanées d'une même saison vide verraient chacune 2 : pas de confettis,
 * sans conséquence.
 */
async function firstOfSeason(
  db: Queryable,
  userId: string,
  startsAt: Date,
): Promise<number | null> {
  const season = seasonOf(toParisIsoDate(startsAt).slice(0, 7));
  const count = await countCompensationsInRange(db, { userId, ...seasonRange(season) });
  return count === 1 ? season : null;
}

/**
 * Crée une indemnité pour `userId` à partir d'un formulaire déjà validé. Un refus
 * (ressource introuvable, pas de barème à la date, limite) annule toute la transaction.
 */
export async function createCompensation(
  deps: CompensationDeps,
  userId: string,
  form: CompensationForm,
): Promise<CreateCompensationResult> {
  return runRejectable(deps, async (db): Promise<CreateCompensationResult> => {
    const { rate, row } = await resolveCompensation(db, userId, form);
    const compensationId = await insertCompensation(db, { ...row, userId });
    if (compensationId === null) {
      reject({ status: "limit_reached", resource: "compensation" });
    }
    return {
      status: "created",
      compensationId,
      amount: amountOf(rate, row),
      firstOfSeason: await firstOfSeason(db, userId, form.startsAt),
      final: await finalToCelebrate(db, userId, row, null),
    };
  });
}

/**
 * Remplace les informations d'une indemnité de `userId`. La ligne de barème est
 * recalculée : changer la date du match peut changer le montant. Le match complet lié
 * reçoit les mêmes informations dans la même transaction (jamais deux versions du match).
 */
export async function updateCompensation(
  deps: CompensationDeps,
  userId: string,
  compensationId: string,
  form: CompensationForm,
): Promise<UpdateCompensationResult> {
  return runRejectable(deps, async (db): Promise<UpdateCompensationResult> => {
    // Verrou d'abord : une suppression simultanée ne peut pas passer entre-temps.
    const locked = await lockCompensation(db, { compensationId, userId });
    if (locked === null) {
      reject({ status: "not_found", field: "compensation" });
    }
    const { rate, row } = await resolveCompensation(db, userId, form);
    await updateCompensationRow(db, { ...row, compensationId, userId });
    await syncGameFromCompensation(db, { compensationId, userId });
    return {
      status: "updated",
      amount: amountOf(rate, row),
      final: await finalToCelebrate(db, userId, row, locked.cupRound),
    };
  });
}
