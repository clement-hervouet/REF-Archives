/**
 * Niveau d'un match vérifié en base, commun à l'indemnité et au match complet (§15.4.6) :
 * la division doit exister, un niveau de coupe exige un tour, et un tour envoyé avec un
 * niveau de championnat est ignoré (la liste n'est pas affichée, mais le formulaire peut
 * revenir d'un niveau de coupe ou être forgé).
 */
import { findDivisionCup } from "../db/divisions";
import type { CupRound } from "../db/divisions";
import type { Queryable } from "../db/users";

export type MatchLevelCheck =
  /** Tour à enregistrer : celui choisi pour une coupe, `null` pour un championnat. */
  | { status: "ok"; cupRound: CupRound | null }
  | { status: "not_found" }
  | { status: "cup_round_required" };

export async function checkMatchLevel(
  db: Queryable,
  input: { divisionId: string; cupRound: CupRound | null },
): Promise<MatchLevelCheck> {
  const division = await findDivisionCup(db, input.divisionId);
  if (division === null) {
    return { status: "not_found" };
  }
  if (!division.cup) {
    return { status: "ok", cupRound: null };
  }
  return input.cupRound === null
    ? { status: "cup_round_required" }
    : { status: "ok", cupRound: input.cupRound };
}
