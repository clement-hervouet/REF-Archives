/**
 * Matchs complets (bloc 9) : création depuis une indemnité et modification des officiels,
 * chacune en une seule transaction.
 *
 * Ni Next.js ni authentification ici : la Server Action vérifie l'utilisateur et valide
 * le formulaire (`officialsSchema`) AVANT d'appeler ce service. Tout refus annule la
 * transaction entière.
 */
import type { Officials } from "@/lib/schemas/officials";
import {
  insertGameFromCompensation,
  linkCompensationToGame,
  lockCompensationLink,
  lockGame,
  updateGameOfficials,
} from "../db/games";
import { rejectGame, runRejectable } from "./rejection";
import type { GameDeps, GameRejection } from "./rejection";
import { resolveOfficials } from "./resolve-officials";

export type CreateGameResult = { status: "created"; gameId: string } | GameRejection;

export type UpdateOfficialsResult = { status: "updated" } | GameRejection;

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
