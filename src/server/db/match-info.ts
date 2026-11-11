/**
 * Fragments partagés pour lire les informations d'un match (division, équipes, adresse)
 * depuis une indemnité (`compensation`, alias `c`) ou un match complet (`game`, alias `g`).
 *
 * Les colonnes et les jointures sont identiques d'une requête à l'autre ; seules changent la
 * table de base et les colonnes supplémentaires. Les jointures reprennent `user_id` : on ne
 * lit jamais l'équipe, le club ou l'adresse d'un autre (§6.2).
 */
import { z } from "zod";
import { divisionCategorySchema, divisionLevelSchema, divisionTypeSchema } from "./divisions";
import type { DivisionCategory, DivisionLevel, DivisionType } from "./divisions";

export type MatchDivision = {
  category: DivisionCategory;
  type: DivisionType;
  level: DivisionLevel;
};
export type MatchAddress = {
  street: string;
  number: string | null;
  postalCode: string;
  city: string;
};

/** Colonnes de la division et des équipes (alias `d`, `club1`, `club2` : sans table de base). */
export const MATCH_PARTIES_COLUMNS = `d.division, d.type, d.level,
  club1.name AS team1_name, club2.name AS team2_name`;

/** Colonnes de l'adresse du match (alias `a`). */
export const MATCH_ADDRESS_COLUMNS = `a.street, a.number, a.postal_code, a.city`;

/** Jointures équipe → club pour les deux équipes, filtrées par propriétaire. */
export function matchTeamJoins(base: "c" | "g"): string {
  return `JOIN team t1 ON t1.id = ${base}.team1_id AND t1.user_id = ${base}.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = ${base}.user_id
JOIN team t2 ON t2.id = ${base}.team2_id AND t2.user_id = ${base}.user_id
JOIN club club2 ON club2.id = t2.club_id AND club2.user_id = ${base}.user_id`;
}

/** Champs Zod de la division et des équipes, à fusionner dans un schéma de ligne. */
export const matchPartiesFields = {
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  team1_name: z.string(),
  team2_name: z.string(),
};

/** Champs Zod de l'adresse du match. */
export const matchAddressFields = {
  street: z.string(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string(),
};

/** Division et noms d'équipes d'une ligne, en forme applicative. */
export function toMatchParties(row: {
  division: DivisionCategory;
  type: DivisionType;
  level: DivisionLevel;
  team1_name: string;
  team2_name: string;
}): { division: MatchDivision; team1Name: string; team2Name: string } {
  return {
    division: { category: row.division, type: row.type, level: row.level },
    team1Name: row.team1_name,
    team2Name: row.team2_name,
  };
}

/** Adresse d'une ligne, en forme applicative. */
export function toMatchAddress(row: {
  street: string;
  number: string | null;
  postal_code: string;
  city: string;
}): MatchAddress {
  return {
    street: row.street,
    number: row.number,
    postalCode: row.postal_code,
    city: row.city,
  };
}
