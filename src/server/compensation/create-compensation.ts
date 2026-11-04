/**
 * Création d'une indemnité autonome (bloc 6), en une seule transaction : clubs et
 * adresses créés à la volée, équipes retrouvées ou créées, ligne de barème en vigueur
 * à la date du match, puis l'indemnité.
 *
 * Ni Next.js ni authentification ici : la Server Action vérifie l'utilisateur et valide
 * le formulaire (`compensationFormSchema`) AVANT d'appeler ce service. Tout refus annule
 * la transaction entière : aucun club ni adresse orphelin ne reste en base.
 */
import { toParisIsoDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import type { CompensationForm } from "@/lib/schemas/compensations";
import {
  addressBelongsTo,
  divisionExists,
  ensureTeam,
  insertAddress,
  insertClub,
  insertCompensation,
  listApplicableRates,
  lockOwnedClubs,
} from "../db/compensations";
import type { LockedClub } from "../db/compensations";
import type { Queryable } from "../db/users";
import { findEffectiveRate } from "../scales/effective-rate";
import { computeCompensation } from "./amount";
import type { CompensationAmount } from "./amount";

/** Exécute `action` dans une transaction (COMMIT si elle réussit, ROLLBACK si elle lève). */
type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

export type CompensationDeps = { transaction: Transaction };

/** Champ du formulaire qui désigne une ressource introuvable (ou pas à l'utilisateur). */
export type NotFoundField = "divisionId" | "scaleId" | "team1" | "team2" | "venue";

export type CreateCompensationRejection =
  | { status: "not_found"; field: NotFoundField }
  /** Le barème choisi n'a aucune ligne en vigueur à la date du match. */
  | { status: "no_rate_at_date" }
  | { status: "limit_reached"; resource: "club" | "compensation" };

export type CreateCompensationResult =
  | { status: "created"; compensationId: string; amount: CompensationAmount }
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

type TeamSide = "team1" | "team2";

/** Club d'une équipe : celui choisi (verrouillé plus tôt) ou un nouveau, avec son adresse. */
async function resolveClub(
  db: Queryable,
  userId: string,
  choice: CompensationForm["team1"],
  side: TeamSide,
  lockedClubs: ReadonlyMap<string, LockedClub>,
): Promise<LockedClub> {
  if (choice.kind === "existing") {
    return lockedClubs.get(choice.clubId) ?? reject({ status: "not_found", field: side });
  }
  const addressId = await insertAddress(db, { userId, address: choice.address });
  const clubId = await insertClub(db, { userId, name: choice.name, addressId });
  return clubId === null
    ? reject({ status: "limit_reached", resource: "club" })
    : { id: clubId, addressId };
}

/** Adresse du match : celle du club de l'équipe 1, sauf exception. */
async function resolveVenue(
  db: Queryable,
  userId: string,
  venue: CompensationForm["venue"],
  club1: LockedClub,
): Promise<string> {
  switch (venue.kind) {
    case "team1":
      return club1.addressId;
    case "existing":
      return (await addressBelongsTo(db, { addressId: venue.addressId, userId }))
        ? venue.addressId
        : reject({ status: "not_found", field: "venue" });
    case "new":
      return insertAddress(db, { userId, address: venue.address });
  }
}

/** Les étapes, dans l'ordre : d'abord tout ce qui peut refuser sans rien écrire. */
async function createInTransaction(
  db: Queryable,
  userId: string,
  form: CompensationForm,
): Promise<CreateCompensationResult> {
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

  const existingClubIds = [form.team1, form.team2].flatMap((team) =>
    team.kind === "existing" ? [team.clubId] : [],
  );
  const lockedClubs = await lockOwnedClubs(db, { userId, clubIds: existingClubIds });
  const club1 = await resolveClub(db, userId, form.team1, "team1", lockedClubs);
  const club2 = await resolveClub(db, userId, form.team2, "team2", lockedClubs);
  const addressId = await resolveVenue(db, userId, form.venue, club1);

  const team1Id = await ensureTeam(db, { userId, clubId: club1.id, divisionId: form.divisionId });
  const team2Id = await ensureTeam(db, { userId, clubId: club2.id, divisionId: form.divisionId });

  const compensationId = await insertCompensation(db, {
    userId,
    scaleRateId: rate.id,
    distanceM: form.distanceM,
    startsAt: form.startsAt,
    divisionId: form.divisionId,
    team1Id,
    team2Id,
    addressId,
  });
  if (compensationId === null) {
    reject({ status: "limit_reached", resource: "compensation" });
  }
  return {
    status: "created",
    compensationId,
    amount: computeCompensation(rate, form.distanceM),
  };
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
  try {
    return await deps.transaction((db) => createInTransaction(db, userId, form));
  } catch (error: unknown) {
    if (error instanceof CompensationRejected) {
      return error.rejection;
    }
    throw error;
  }
}
