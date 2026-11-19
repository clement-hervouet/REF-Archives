/**
 * Préparation de match (§15.4.10, §6.3). Nombre d'équipes de la poule (un seul : les deux
 * équipes sont dans la même poule). Par équipe : classement (position, victoires, défaites),
 * notes sur les joueurs et les coachs, case « déjà arbitrée ». Pour le trio arbitral : cinq
 * textes et la case « observé ».
 *
 * Tous les champs sont facultatifs, mais une préparation vide est refusée : au moins un
 * nombre ou un texte. Les cases seules ne suffisent pas (elles sont souvent pré-cochées).
 */
import { z } from "zod";
import {
  CREW_FIELDS,
  PREPARATION_TEAMS,
  RECORD_MAX,
  TEAM_COUNT_MAX,
  TEAM_COUNT_MIN,
} from "@/lib/preparation-form-fields";
import type { CrewField } from "@/lib/preparation-form-fields";
import { noteBodySchema } from "./notes";

/**
 * Texte libre, multiligne, 4 096 caractères au plus, sans caractère de contrôle (hors saut
 * de ligne et tabulation) : mêmes règles que le texte de la note. Vide → `null`.
 */
const preparationTextSchema = noteBodySchema;

/** Nombre entier saisi dans un champ ; vide → `null`. */
function optionalInteger(min: number, max: number) {
  return z
    .string()
    .trim()
    .regex(/^\d{0,3}$/)
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(z.number().int().min(min).max(max).nullable());
}

const teamSchema = z.object({
  rank: optionalInteger(1, TEAM_COUNT_MAX),
  wins: optionalInteger(0, RECORD_MAX),
  losses: optionalInteger(0, RECORD_MAX),
  players: preparationTextSchema,
  coaches: preparationTextSchema,
  alreadyRefereed: z.boolean(),
});

const crewSchema = z.object({
  placement: preparationTextSchema,
  communication: preparationTextSchema,
  management: preparationTextSchema,
  table: preparationTextSchema,
  contact: preparationTextSchema,
} satisfies Record<CrewField, typeof preparationTextSchema>);

export type TeamPreparation = z.output<typeof teamSchema>;

/** Vrai si l'équipe a au moins un nombre ou un texte renseigné (la case ne compte pas). */
function teamHasContent(team: TeamPreparation): boolean {
  return [team.rank, team.wins, team.losses, team.players, team.coaches].some(
    (value) => value !== null,
  );
}

/**
 * Formulaire complet de préparation : au moins un nombre ou un texte renseigné, et aucune
 * position au-delà du nombre d'équipes de la poule.
 */
export const preparationFormSchema = z
  .object({
    teamCount: optionalInteger(TEAM_COUNT_MIN, TEAM_COUNT_MAX),
    team1: teamSchema,
    team2: teamSchema,
    crew: crewSchema,
    observed: z.boolean(),
  })
  .superRefine((value, ctx) => {
    for (const team of PREPARATION_TEAMS) {
      const rank = value[team].rank;
      if (rank !== null && value.teamCount !== null && rank > value.teamCount) {
        ctx.addIssue({ code: "custom", path: [team, "rank"], message: "rank_above_count" });
      }
    }
    const crewHasContent = CREW_FIELDS.some((field) => value.crew[field] !== null);
    if (
      value.teamCount === null &&
      !crewHasContent &&
      !teamHasContent(value.team1) &&
      !teamHasContent(value.team2)
    ) {
      ctx.addIssue({ code: "custom", path: [], message: "empty_preparation" });
    }
  });

export type PreparationForm = z.output<typeof preparationFormSchema>;
