/**
 * Matchs complets (bloc 9) : création depuis une indemnité ou sans indemnité, modification
 * des officiels et des informations du match, chacune en une seule transaction.
 *
 * Ni Next.js ni authentification ici : la Server Action vérifie l'utilisateur et valide
 * le formulaire (`officialsSchema`) AVANT d'appeler ce service. Tout refus annule la
 * transaction entière.
 */
import { toParisIsoDate } from "@/lib/dates";
import type { MatchInfo } from "@/lib/schemas/compensations";
import type { Officials } from "@/lib/schemas/officials";
import { resolveMatchInfo } from "../compensation/resolve-match";
import { divisionExists, listApplicableRates } from "../db/compensations";
import {
  insertGame,
  insertGameFromCompensation,
  linkCompensationToGame,
  lockCompensationLink,
  lockGame,
  lockLinkedCompensation,
  updateCompensationFromGame,
  updateGameInfo as updateGameInfoRow,
  updateGameOfficials,
} from "../db/game-writes";
import { findEffectiveRate } from "../scales/effective-rate";
import { rejectGame, runRejectable } from "./rejection";
import type { GameDeps, GameRejection } from "./rejection";
import { resolveOfficials } from "./resolve-officials";

export type CreateGameResult = { status: "created"; gameId: string } | GameRejection;

export type UpdateOfficialsResult = { status: "updated" } | GameRejection;

export type UpdateGameInfoResult = { status: "updated" } | GameRejection;

/**
 * Crée le match complet d'une indemnité de `userId` : date, niveau, équipes et adresse
 * sont repris de l'indemnité, puis les deux sont liés. Une indemnité qui a déjà un match
 * renvoie `already_linked` avec son identifiant.
 */
export async function createGameFromCompensation(
  deps: GameDeps,
  userId: string,
  compensationId: string,
  officials: Officials,
): Promise<CreateGameResult> {
  return runRejectable(deps, async (db): Promise<CreateGameResult> => {
    // Verrou d'abord : deux envois simultanés ne créent pas deux matchs.
    const link = await lockCompensationLink(db, { compensationId, userId });
    if (!link.found) {
      rejectGame({ status: "not_found", field: "compensation" });
    }
    if (link.gameId !== null) {
      rejectGame({ status: "already_linked", gameId: link.gameId });
    }
    const officialIds = await resolveOfficials(db, userId, officials);
    const gameId =
      (await insertGameFromCompensation(db, { userId, compensationId, officials: officialIds })) ??
      rejectGame({ status: "limit_reached", resource: "game" });
    await linkCompensationToGame(db, { userId, compensationId, gameId });
    return { status: "created", gameId };
  });
}

/** Remplace les officiels d'un match de `userId`. */
export async function updateOfficials(
  deps: GameDeps,
  userId: string,
  gameId: string,
  officials: Officials,
): Promise<UpdateOfficialsResult> {
  return runRejectable(deps, async (db): Promise<UpdateOfficialsResult> => {
    if (!(await lockGame(db, { gameId, userId }))) {
      rejectGame({ status: "not_found", field: "game" });
    }
    const officialIds = await resolveOfficials(db, userId, officials);
    await updateGameOfficials(db, { gameId, userId, officials: officialIds });
    return { status: "updated" };
  });
}

/**
 * Crée un match complet sans indemnité (bloc 9e) : niveau vérifié avant toute écriture,
 * puis clubs, adresse et équipes (créés à la volée si besoin), officiels, et le match.
 */
export async function createStandaloneGame(
  deps: GameDeps,
  userId: string,
  info: MatchInfo,
  officials: Officials,
): Promise<CreateGameResult> {
  return runRejectable(deps, async (db): Promise<CreateGameResult> => {
    if (!(await divisionExists(db, info.divisionId))) {
      rejectGame({ status: "not_found", field: "divisionId" });
    }
    const match = await resolveMatchInfo(db, userId, info, rejectGame);
    const officialIds = await resolveOfficials(db, userId, officials);
    const gameId =
      (await insertGame(db, { userId, match, officials: officialIds })) ??
      rejectGame({ status: "limit_reached", resource: "game" });
    return { status: "created", gameId };
  });
}

/**
 * Remplace les informations d'un match de `userId` (date, niveau, équipes, adresse). Une
 * indemnité liée reçoit les mêmes informations dans la même transaction, avec la ligne
 * de son barème en vigueur à la nouvelle date : changer la date peut changer le montant.
 */
export async function updateGameInfo(
  deps: GameDeps,
  userId: string,
  gameId: string,
  info: MatchInfo,
): Promise<UpdateGameInfoResult> {
  return runRejectable(deps, async (db): Promise<UpdateGameInfoResult> => {
    // Indemnité puis match : même ordre de verrous que la modification d'une indemnité.
    const linked = await lockLinkedCompensation(db, { gameId, userId });
    if (!(await lockGame(db, { gameId, userId }))) {
      rejectGame({ status: "not_found", field: "game" });
    }
    if (!(await divisionExists(db, info.divisionId))) {
      rejectGame({ status: "not_found", field: "divisionId" });
    }
    let scaleRateId: string | null = null;
    if (linked !== null) {
      // Barème supprimé depuis (null) ou sans ligne à la nouvelle date : on refuse plutôt
      // que de laisser l'indemnité sur une ligne qui ne correspond plus au match.
      const rates = await listApplicableRates(db, { scaleId: linked.scaleId, userId });
      const rate = rates === null ? null : findEffectiveRate(rates, toParisIsoDate(info.startsAt));
      scaleRateId = rate?.id ?? rejectGame({ status: "no_rate_at_date" });
    }
    const match = await resolveMatchInfo(db, userId, info, rejectGame);
    await updateGameInfoRow(db, { gameId, userId, match });
    if (linked !== null && scaleRateId !== null) {
      await updateCompensationFromGame(db, {
        compensationId: linked.compensationId,
        userId,
        match,
        scaleRateId,
      });
    }
    return { status: "updated" };
  });
}
