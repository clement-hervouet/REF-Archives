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
import {
  countCompensationsInRange,
  divisionExists,
  insertCompensation,
  listApplicableRates,
  lockCompensation,
  updateCompensation as updateCompensationRow,
} from "../db/compensations";
import type { ApplicableRate, NewCompensation } from "../db/compensations";
import { syncGameFromCompensation } from "../db/games";
import type { Queryable, Transaction } from "../db/users";
import { findEffectiveRate } from "../scales/effective-rate";
import { computeCompensation } from "./amount";
import type { CompensationAmount } from "./amount";
import { resolveMatchInfo } from "./resolve-match";

export type CompensationDeps = { transaction: Transaction };

/**
 * Ressource introuvable (ou pas à l'utilisateur) : un champ du formulaire, ou
 * l'indemnité elle-même pour une modification.
 */
type NotFoundField = "divisionId" | "scaleId" | "team1" | "team2" | "venue" | "compensation";

export type CreateCompensationRejection =
  | { status: "not_found"; field: NotFoundField }
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
    }
  | CreateCompensationRejection;

export type UpdateCompensationResult =
  { status: "updated"; amount: CompensationAmount } | CreateCompensationRejection;

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
  if (!(await divisionExists(db, form.divisionId))) {
    reject({ status: "not_found", field: "divisionId" });
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

  const match = await resolveMatchInfo(db, userId, form, reject);

  return {
    rate,
    row: { ...match, scaleRateId: rate.id, distanceM: form.distanceM, payer: form.payer },
  };
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
      amount: computeCompensation(rate, form.distanceM),
      firstOfSeason: await firstOfSeason(db, userId, form.startsAt),
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
    if (!(await lockCompensation(db, { compensationId, userId }))) {
      reject({ status: "not_found", field: "compensation" });
    }
    const { rate, row } = await resolveCompensation(db, userId, form);
    await updateCompensationRow(db, { ...row, compensationId, userId });
    await syncGameFromCompensation(db, { compensationId, userId });
    return { status: "updated", amount: computeCompensation(rate, form.distanceM) };
  });
}
