/**
 * Formulaires des informations d'un match complet (bloc 9e) : création d'un match sans
 * indemnité (informations + officiels) et modification des informations depuis sa fiche.
 * Mêmes champs HTML que le formulaire d'indemnité (sans barème ni distance) et que celui
 * des officiels. Ni Next.js ni authentification ici : la Server Action vérifie la session.
 */
import { z } from "zod";
import type { CompensationField } from "@/lib/compensation-form-fields";
import { toParisIsoDate } from "@/lib/dates";
import { readText } from "@/lib/form-data";
import { toParisTimeOfDay } from "@/lib/paris-time";
import { matchInfoFormSchema } from "@/lib/schemas/compensations";
import type { OfficialSlot } from "@/lib/schemas/officials";
import { officialsSchema } from "@/lib/schemas/officials";
import { invalidFields, readCompensationFormData } from "../compensation/compensation-form";
import type { GameForEdit } from "../db/games";
import { createStandaloneGame, updateGameInfo } from "./manage-game";
import { officialsErrors, readOfficialsFormData } from "./officials-form";
import type { OfficialsFieldError } from "./officials-form";
import type { GameDeps, GameRejection } from "./rejection";

export type GameFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      fields: CompensationField[];
      officials: Partial<Record<OfficialSlot, OfficialsFieldError>>;
    }
  | GameRejection
  | { status: "created"; gameId: string }
  | { status: "updated" };

/** Valide informations et officiels ensemble (toutes les erreurs en un envoi), puis crée. */
export async function handleCreateStandaloneGame(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<GameFormState> {
  // Les champs barème et distance, absents de ce formulaire, sont ignorés par le schéma.
  const info = matchInfoFormSchema.safeParse(readCompensationFormData(formData));
  const officials = officialsSchema.safeParse(readOfficialsFormData(formData));
  if (!info.success || !officials.success) {
    return {
      status: "invalid",
      fields: info.success ? [] : invalidFields(info.error),
      officials: officials.success ? {} : officialsErrors(officials.error),
    };
  }
  return createStandaloneGame(deps, userId, info.data, officials.data);
}

/**
 * Valide puis remplace les informations du match désigné par le champ caché `gameId`.
 * Le service vérifie qu'il appartient à `userId` et met à jour l'indemnité liée.
 */
export async function handleUpdateGameInfo(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<GameFormState> {
  const gameId = z.uuid().safeParse(readText(formData, "gameId"));
  if (!gameId.success) {
    return { status: "not_found", field: "game" };
  }
  const info = matchInfoFormSchema.safeParse(readCompensationFormData(formData));
  if (!info.success) {
    return { status: "invalid", fields: invalidFields(info.error), officials: {} };
  }
  return updateGameInfo(deps, userId, gameId.data, info.data);
}

/**
 * Valeurs du formulaire pour modifier un match : mêmes noms de champs que l'indemnité.
 * L'adresse n'est une « exception » que si elle diffère de celle du club de l'équipe 1.
 */
export function gameInfoFormValues(game: GameForEdit): Record<string, string> {
  const values: Record<string, string> = {
    date: toParisIsoDate(game.startsAt),
    time: toParisTimeOfDay(game.startsAt),
    divisionId: game.divisionId,
    team1Club: game.team1ClubId,
    team2Club: game.team2ClubId,
  };
  if (game.addressId !== game.team1AddressId) {
    values.venueException = "on";
    values.venueAddress = game.addressId;
  }
  return values;
}
