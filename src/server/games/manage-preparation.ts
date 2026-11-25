/**
 * Préparation de match (§15.4.10) : écrite sous verrou du match (une suppression
 * simultanée du match ne peut pas passer entre-temps, deux enregistrements simultanés
 * passent l'un après l'autre), jamais pour un plateau, et champ par champ : seuls les
 * champs modifiés dans le formulaire sont écrits (voir `preparation-values.ts`). Création du
 * match complet depuis une indemnité pour la préparer (« Préparer le match »).
 *
 * Ni Next.js ni authentification ici : la Server Action vérifie l'utilisateur et valide le
 * formulaire (`preparationFormSchema`) AVANT d'appeler ce service.
 */
import type { Officials } from "@/lib/schemas/officials";
import type { PreparationForm } from "@/lib/schemas/preparations";
import { findCompensationForGame } from "../db/games";
import { findPreparation, lockGameForPreparation, savePreparation } from "../db/preparations";
import { createGameFromCompensation } from "./manage-game";
import { mergePreparation, preparationValues } from "./preparation-values";
import type { GameDeps } from "./rejection";

export type SavePreparationResult =
  | { status: "saved" }
  | { status: "not_found" }
  /** Plateau (§15.4.7) : pas de préparation. */
  | { status: "plateau" }
  /**
   * Modifiée ailleurs entre-temps, rien n'est écrit : `saved` est la préparation
   * enregistrée (valeurs de formulaire, nouvelles valeurs de départ), `conflicts` les
   * champs (noms HTML) à signaler.
   */
  | {
      status: "conflict";
      saved: Readonly<Record<string, string>>;
      conflicts: readonly string[];
    };

/**
 * Crée la préparation d'un match de `userId`, ou y écrit les champs modifiés depuis
 * `base` (valeurs de départ du formulaire).
 */
export async function saveGamePreparation(
  deps: GameDeps,
  userId: string,
  gameId: string,
  input: { preparation: PreparationForm; base: PreparationForm },
): Promise<SavePreparationResult> {
  return deps.transaction(async (db): Promise<SavePreparationResult> => {
    const game = await lockGameForPreparation(db, { gameId, userId });
    if (game === null) {
      return { status: "not_found" };
    }
    if (game.plateau) {
      return { status: "plateau" };
    }
    // Lue après le verrou du match : un enregistrement concurrent est déjà validé.
    const current = await findPreparation(db, { gameId, userId });
    // Pas encore de préparation (ou supprimée entre-temps) : la saisie est écrite telle quelle.
    if (current === null) {
      await savePreparation(db, {
        userId,
        gameId,
        updatedBy: userId,
        preparation: input.preparation,
      });
      return { status: "saved" };
    }
    const merged = mergePreparation({ base: input.base, mine: input.preparation, current });
    if (merged.status === "conflict") {
      return { status: "conflict", saved: preparationValues(current), conflicts: merged.conflicts };
    }
    await savePreparation(db, {
      userId,
      gameId,
      updatedBy: userId,
      preparation: merged.preparation,
    });
    return { status: "saved" };
  });
}

/** Officiels du match créé pour une préparation : l'utilisateur arbitre 1, comme « Compléter le match ». */
const SELF_AS_REFEREE1: Officials = {
  referee1: { kind: "self" },
  referee2: { kind: "none" },
  referee3: { kind: "none" },
  observer: { kind: "none" },
};

export type PrepareFromCompensationResult =
  | { status: "ready"; gameId: string }
  | { status: "not_found" }
  | { status: "plateau" }
  | { status: "limit_reached" };

/**
 * Match complet à préparer pour une indemnité de `userId` : celui qui est déjà lié, sinon
 * un match créé depuis l'indemnité (l'utilisateur arbitre 1, modifiable ensuite sur la
 * fiche). Un plateau n'a pas de préparation.
 */
export async function prepareFromCompensation(
  deps: GameDeps,
  userId: string,
  compensationId: string,
): Promise<PrepareFromCompensationResult> {
  // Lecture préalable : un plateau ne doit pas recevoir de match complet pour rien. La
  // création reste protégée par le verrou de `createGameFromCompensation`.
  const compensation = await deps.transaction((db) =>
    findCompensationForGame(db, { compensationId, userId }),
  );
  if (compensation === null) {
    return { status: "not_found" };
  }
  if (compensation.team2Name === null) {
    return { status: "plateau" };
  }
  if (compensation.gameId !== null) {
    return { status: "ready", gameId: compensation.gameId };
  }
  const created = await createGameFromCompensation(deps, userId, compensationId, SELF_AS_REFEREE1);
  switch (created.status) {
    case "created":
      return { status: "ready", gameId: created.gameId };
    // Deux onglets : le match a été créé entre-temps.
    case "already_linked":
      return { status: "ready", gameId: created.gameId };
    case "limit_reached":
      return { status: "limit_reached" };
    default:
      return { status: "not_found" };
  }
}
