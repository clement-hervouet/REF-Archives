/**
 * Niveau d'un match vérifié en base, commun à l'indemnité et au match complet :
 * - la division doit exister ;
 * - coupe (§15.4.6) : un tour est obligatoire ; hors coupe, un tour envoyé est ignoré ;
 * - plateau (§15.4.7) : club organisateur seul (une équipe 2 envoyée est ignorée) et, pour
 *   une indemnité, un nombre de matchs et un montant par match obligatoires ; hors plateau,
 *   l'équipe 2 est obligatoire et nombre et montant envoyés sont ignorés. Pas de doublé sur
 *   un plateau : le déplacement est toujours indemnisé (choix de Clem).
 * Les listes concernées ne sont affichées que pour le bon niveau, mais le formulaire peut
 * revenir d'un autre niveau ou être forgé : rien n'est cru sur parole.
 */
import type { CompensationField } from "@/lib/compensation-form-fields";
import type { MatchInfo } from "@/lib/schemas/compensations";
import { findDivisionKind } from "../db/divisions";
import type { CupRound } from "../db/divisions";
import type { Queryable } from "../db/users";

type MatchLevelInput = Pick<MatchInfo, "divisionId" | "cupRound" | "team2"> & {
  /** Nombre de matchs saisi ; `undefined` pour un match complet (pas de montant). */
  gameCount?: number | null;
  /** Montant par match saisi (centimes) ; `undefined` pour un match complet. */
  plateauGameCents?: number | null;
};

export type MatchLevelCheck =
  /** Valeurs à enregistrer, ramenées à ce que le niveau autorise. */
  | {
      status: "ok";
      cupRound: CupRound | null;
      team2: MatchInfo["team2"];
      gameCount: number | null;
      plateauGameCents: number | null;
      /** Niveau de plateau : la case « doublé » ne s'applique pas. */
      plateau: boolean;
    }
  | { status: "not_found" }
  /** Champs manquants pour ce niveau (tour, équipe 2, nombre de matchs). */
  | { status: "invalid"; fields: CompensationField[] };

export async function checkMatchLevel(
  db: Queryable,
  input: MatchLevelInput,
): Promise<MatchLevelCheck> {
  const division = await findDivisionKind(db, input.divisionId);
  if (division === null) {
    return { status: "not_found" };
  }
  const missing: CompensationField[] = [];
  if (division.cup && input.cupRound === null) {
    missing.push("cupRound");
  }
  if (!division.plateau && input.team2 === null) {
    missing.push("team2");
  }
  if (division.plateau && input.gameCount === null) {
    missing.push("gameCount");
  }
  if (division.plateau && input.plateauGameCents === null) {
    missing.push("plateauGameAmount");
  }
  if (missing.length > 0) {
    return { status: "invalid", fields: missing };
  }
  return {
    status: "ok",
    cupRound: division.cup ? input.cupRound : null,
    team2: division.plateau ? null : input.team2,
    gameCount: division.plateau ? (input.gameCount ?? null) : null,
    plateauGameCents: division.plateau ? (input.plateauGameCents ?? null) : null,
    plateau: division.plateau,
  };
}
