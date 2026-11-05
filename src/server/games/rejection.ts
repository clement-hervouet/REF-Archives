/**
 * Refus des services de matchs complets (bloc 9). Comme pour les indemnités, un refus est
 * levé dans la transaction pour l'annuler entièrement (aucun collègue orphelin), puis
 * transformé en résultat typé pour la Server Action.
 */
import { AppError } from "@/lib/errors";
import type { OfficialSlot } from "@/lib/schemas/officials";
import type { Queryable } from "../db/users";

/** Champ du formulaire d'informations du match (niveau, équipes, adresse). */
export type MatchInfoField = "divisionId" | "team1" | "team2" | "venue";

export type GameRejection =
  /** Indemnité, match, collègue ou élément du match introuvable (ou pas à l'utilisateur). */
  | { status: "not_found"; field: "compensation" | "game" | OfficialSlot | MatchInfoField }
  /** L'indemnité a déjà un match complet : l'interface y renvoie. */
  | { status: "already_linked"; gameId: string }
  /**
   * Modification depuis la fiche (bloc 9e) : le barème de l'indemnité liée n'a aucune ligne
   * en vigueur à la nouvelle date, ou il a été supprimé.
   */
  | { status: "no_rate_at_date" }
  | { status: "limit_reached"; resource: "game" | "colleague" | "club" };

/** Exécute `action` dans une transaction (COMMIT si elle réussit, ROLLBACK si elle lève). */
type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

export type GameDeps = { transaction: Transaction };

/** Refus levé dans la transaction pour la faire annuler ; jamais visible hors du module. */
class GameRejected extends AppError {
  override readonly name = "GameRejected";

  constructor(readonly rejection: GameRejection) {
    super(rejection.status);
  }
}

export function rejectGame(rejection: GameRejection): never {
  throw new GameRejected(rejection);
}

/** Exécute `action` dans une transaction et transforme un refus en résultat. */
export async function runRejectable<T>(
  deps: GameDeps,
  action: (db: Queryable) => Promise<T>,
): Promise<T | GameRejection> {
  try {
    return await deps.transaction(action);
  } catch (error: unknown) {
    if (error instanceof GameRejected) {
      return error.rejection;
    }
    throw error;
  }
}
