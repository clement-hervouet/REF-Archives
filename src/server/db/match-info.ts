/**
 * Fragments partagés pour lire les informations d'un match (division, équipes, adresse)
 * depuis une indemnité (`compensation`, alias `c`) ou un match complet (`game`, alias `g`).
 *
 * Les colonnes et les jointures sont identiques d'une requête à l'autre ; seules changent la
 * table de base et les colonnes supplémentaires. Les jointures reprennent `user_id` : on ne
 * lit jamais l'équipe, le club ou l'adresse d'un autre (§6.2).
 */
import { z } from "zod";
import { departmentFromPostalCode } from "@/lib/payers";
import type { DepartmentCode } from "@/lib/payers";
import {
  cupRoundSchema,
  divisionCategorySchema,
  divisionLevelSchema,
  divisionTypeSchema,
} from "./divisions";
import type { CupRound, DivisionCategory, DivisionLevel, DivisionType } from "./divisions";

/** Niveau d'un match : sa division, et pour une coupe son tour et le département du lieu. */
export type MatchDivision = {
  category: DivisionCategory;
  type: DivisionType;
  level: DivisionLevel;
  /** Niveau de coupe (§15.4.6). */
  cup: boolean;
  /** Tour de coupe, `null` hors coupe. */
  cupRound: CupRound | null;
  /**
   * Département de l'adresse du match, qui donne son nom à la coupe (« COUPE 56 »,
   * « CB… ») ; `null` hors coupe ou si l'adresse est à l'étranger.
   */
  department: DepartmentCode | null;
};
/** Adresse du match ; rue et ville `null` si c'est celle d'un club pas encore complétée (§15.4.1). */
export type MatchAddress = {
  street: string | null;
  number: string | null;
  postalCode: string;
  city: string | null;
};

/**
 * Colonnes de la division et des équipes (alias `d`, `club1`, `club2`), plus le tour et le
 * lieu d'un match de coupe, lus depuis la table de base (`c` ou `g`). Le code postal n'est
 * lu que pour une coupe (sous-requête filtrée par propriétaire, sur la clé primaire).
 */
export function matchPartiesColumns(base: "c" | "g"): string {
  return `d.division, d.type, d.level, d.cup, ${base}.cup_round,
  CASE WHEN d.cup THEN (SELECT cup_a.postal_code FROM address cup_a
    WHERE cup_a.id = ${base}.address_id AND cup_a.user_id = ${base}.user_id) END AS cup_postal_code,
  CASE WHEN d.cup THEN (SELECT cup_a.country FROM address cup_a
    WHERE cup_a.id = ${base}.address_id AND cup_a.user_id = ${base}.user_id) END AS cup_country,
  club1.name AS team1_name, club2.name AS team2_name`;
}

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
  cup: z.boolean(),
  cup_round: cupRoundSchema.nullable(),
  cup_postal_code: z.string().nullable(),
  cup_country: z.string().nullable(),
  team1_name: z.string(),
  team2_name: z.string(),
};

/** Champs Zod de l'adresse du match. */
export const matchAddressFields = {
  street: z.string().nullable(),
  number: z.string().nullable(),
  postal_code: z.string(),
  city: z.string().nullable(),
};

type MatchDivisionRow = {
  division: DivisionCategory;
  type: DivisionType;
  level: DivisionLevel;
  cup: boolean;
  cup_round: CupRound | null;
  cup_postal_code: string | null;
  cup_country: string | null;
};

/** Niveau du match d'une ligne (colonnes de `matchPartiesColumns`), en forme applicative. */
function toMatchDivision(row: MatchDivisionRow): MatchDivision {
  return {
    category: row.division,
    type: row.type,
    level: row.level,
    cup: row.cup,
    // Un tour hors coupe ne s'affiche pas (la base ne lie pas les deux colonnes).
    cupRound: row.cup ? row.cup_round : null,
    department:
      row.cup && row.cup_postal_code !== null
        ? departmentFromPostalCode(row.cup_postal_code, row.cup_country)
        : null,
  };
}

/** Division et noms d'équipes d'une ligne, en forme applicative. */
export function toMatchParties(
  row: MatchDivisionRow & { team1_name: string; team2_name: string },
): { division: MatchDivision; team1Name: string; team2Name: string } {
  return {
    division: toMatchDivision(row),
    team1Name: row.team1_name,
    team2Name: row.team2_name,
  };
}

/** Adresse d'une ligne, en forme applicative. */
export function toMatchAddress(row: {
  street: string | null;
  number: string | null;
  postal_code: string;
  city: string | null;
}): MatchAddress {
  return {
    street: row.street,
    number: row.number,
    postalCode: row.postal_code,
    city: row.city,
  };
}
