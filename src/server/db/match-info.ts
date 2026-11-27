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
  /** Niveau de plateau (§15.4.7) : club organisateur seul. */
  plateau: boolean;
  /** Tour de coupe, `null` hors coupe. */
  cupRound: CupRound | null;
  /**
   * Département de l'adresse du match, qui donne son nom à la coupe (« COUPE 56 »,
   * « CB… ») ou au plateau (« PlaD56… ») ; `null` sinon, ou si l'adresse est à l'étranger.
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
 * lieu d'un match de coupe ou de plateau, lus depuis la table de base (`c` ou `g`). Le code
 * postal n'est lu que pour une coupe ou un plateau, dont le nom en dépend (sous-requête
 * filtrée par propriétaire, sur la clé primaire).
 */
export function matchPartiesColumns(base: "c" | "g"): string {
  return `d.division, d.type, d.level, d.cup, d.plateau, ${base}.cup_round,
  CASE WHEN d.cup OR d.plateau THEN (SELECT cup_a.postal_code FROM address cup_a
    WHERE cup_a.id = ${base}.address_id AND cup_a.user_id = ${base}.user_id) END AS cup_postal_code,
  CASE WHEN d.cup OR d.plateau THEN (SELECT cup_a.country FROM address cup_a
    WHERE cup_a.id = ${base}.address_id AND cup_a.user_id = ${base}.user_id) END AS cup_country,
  club1.name AS team1_name, club2.name AS team2_name`;
}

/** Colonnes de l'adresse du match (alias `a`). */
export const MATCH_ADDRESS_COLUMNS = `a.street, a.number, a.postal_code, a.city`;

/**
 * Jointures équipe → club pour les deux équipes, filtrées par propriétaire. L'équipe 2 est
 * en LEFT JOIN : un plateau n'en a pas (§15.4.7).
 */
export function matchTeamJoins(base: "c" | "g"): string {
  return `JOIN team t1 ON t1.id = ${base}.team1_id AND t1.user_id = ${base}.user_id
JOIN club club1 ON club1.id = t1.club_id AND club1.user_id = ${base}.user_id
LEFT JOIN team t2 ON t2.id = ${base}.team2_id AND t2.user_id = ${base}.user_id
LEFT JOIN club club2 ON club2.id = t2.club_id AND club2.user_id = ${base}.user_id`;
}

/** Champs Zod de la division et des équipes, à fusionner dans un schéma de ligne. */
export const matchPartiesFields = {
  division: divisionCategorySchema,
  type: divisionTypeSchema,
  level: divisionLevelSchema,
  cup: z.boolean(),
  plateau: z.boolean(),
  cup_round: cupRoundSchema.nullable(),
  cup_postal_code: z.string().nullable(),
  cup_country: z.string().nullable(),
  team1_name: z.string(),
  team2_name: z.string().nullable(),
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
  plateau: boolean;
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
    plateau: row.plateau,
    // Un tour hors coupe ne s'affiche pas (la base ne lie pas les deux colonnes).
    cupRound: row.cup ? row.cup_round : null,
    department:
      (row.cup || row.plateau) && row.cup_postal_code !== null
        ? departmentFromPostalCode(row.cup_postal_code, row.cup_country)
        : null,
  };
}

/** Division et noms d'équipes d'une ligne, en forme applicative. */
export function toMatchParties(
  row: MatchDivisionRow & { team1_name: string; team2_name: string | null },
): { division: MatchDivision; team1Name: string; team2Name: string | null } {
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

// ─── Clubs des équipes (pastilles) ──────────────────────────────────────────

/** Club d'une équipe, pour sa pastille (logo FFBB, sinon initiales sur sa couleur). */
export type MatchClub = {
  id: string;
  name: string;
  /** Couleur du club `#rrggbb` (FFBB), `null` si inconnue. */
  color: string | null;
  /** Logo FFBB du club, `null` s'il n'en a pas. */
  logoUuid: string | null;
};

export type MatchClubs = {
  team1Club: MatchClub;
  /** `null` pour un plateau (club organisateur seul, §15.4.7). */
  team2Club: MatchClub | null;
};

/**
 * Colonnes des clubs des deux équipes (alias `club1`, `club2` de `matchTeamJoins`), à
 * ajouter aux requêtes dont l'en-tête montre les pastilles, avec `matchPartiesColumns`.
 */
export const MATCH_CLUBS_COLUMNS = `club1.id AS team1_club_id, club1.color AS team1_color,
  club1.ffbb_logo_uuid AS team1_logo_uuid,
  club2.id AS team2_club_id, club2.color AS team2_color, club2.ffbb_logo_uuid AS team2_logo_uuid`;

/** Champs Zod des clubs des équipes, à fusionner avec `matchPartiesFields`. */
export const matchClubsFields = {
  team1_club_id: z.uuid(),
  team1_color: z.string().nullable(),
  team1_logo_uuid: z.uuid().nullable(),
  team2_club_id: z.uuid().nullable(),
  team2_color: z.string().nullable(),
  team2_logo_uuid: z.uuid().nullable(),
};

/** Clubs des équipes d'une ligne (colonnes de `MATCH_CLUBS_COLUMNS`), en forme applicative. */
export function toMatchClubs(row: {
  team1_name: string;
  team2_name: string | null;
  team1_club_id: string;
  team1_color: string | null;
  team1_logo_uuid: string | null;
  team2_club_id: string | null;
  team2_color: string | null;
  team2_logo_uuid: string | null;
}): MatchClubs {
  return {
    team1Club: {
      id: row.team1_club_id,
      name: row.team1_name,
      color: row.team1_color,
      logoUuid: row.team1_logo_uuid,
    },
    team2Club:
      row.team2_club_id === null || row.team2_name === null
        ? null
        : {
            id: row.team2_club_id,
            name: row.team2_name,
            color: row.team2_color,
            logoUuid: row.team2_logo_uuid,
          },
  };
}
