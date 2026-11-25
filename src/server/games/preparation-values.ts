/**
 * Préparation de match (§15.4.10) en valeurs de formulaire (une chaîne par champ HTML), et
 * fusion champ par champ à l'enregistrement. Pur, sans base ni Next.js : testé à part.
 *
 * Fusion : le formulaire envoie, pour chaque champ, la valeur saisie et sa valeur de départ
 * (champ caché `base.…`). Comparées à la valeur enregistrée au moment d'écrire :
 *  * champ modifié dans le formulaire seulement → la saisie est écrite ;
 *  * champ modifié ailleurs seulement (autre onglet, autre appareil) → la valeur
 *    enregistrée est gardée, jamais écrasée par une valeur de départ périmée ;
 *  * champ modifié des deux côtés, différemment → conflit : rien n'est écrit, le champ est
 *    signalé avec la version enregistrée ;
 *  * fusion qui viole une règle d'ensemble (position au-delà du nombre d'équipes,
 *    préparation vidée) → conflit sur les champs modifiés ailleurs.
 * Les valeurs sont comparées une fois normalisées par le schéma (« 05 » vaut « 5 »).
 */
import {
  CHECKBOX_ON,
  CREW_FIELDS,
  OBSERVED_FIELD,
  PREPARATION_FIELDS,
  TEAM_COUNT_FIELD,
  TEAM_NUMBER_PARTS,
  TEAM_REFEREED_PART,
  TEAM_TEXT_PARTS,
  teamFieldName,
} from "@/lib/preparation-form-fields";
import type { PreparationTeam } from "@/lib/preparation-form-fields";
import { preparationFormSchema } from "@/lib/schemas/preparations";
import type { PreparationForm, TeamPreparation } from "@/lib/schemas/preparations";

function numberValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function teamValues(team: PreparationTeam, values: TeamPreparation): Record<string, string> {
  return {
    [teamFieldName(team, "Rank")]: numberValue(values.rank),
    [teamFieldName(team, "Wins")]: numberValue(values.wins),
    [teamFieldName(team, "Losses")]: numberValue(values.losses),
    [teamFieldName(team, "Players")]: values.players ?? "",
    [teamFieldName(team, "Coaches")]: values.coaches ?? "",
    [teamFieldName(team, TEAM_REFEREED_PART)]: values.alreadyRefereed ? CHECKBOX_ON : "",
  };
}

/** Valeurs de formulaire d'une préparation : une chaîne par champ HTML. */
export function preparationValues(preparation: PreparationForm): Record<string, string> {
  return {
    [TEAM_COUNT_FIELD]: numberValue(preparation.teamCount),
    ...teamValues("team1", preparation.team1),
    ...teamValues("team2", preparation.team2),
    ...Object.fromEntries(CREW_FIELDS.map((field) => [field, preparation.crew[field] ?? ""])),
    [OBSERVED_FIELD]: preparation.observed ? CHECKBOX_ON : "",
  };
}

/** Clés du schéma pour une partie d'équipe : `Rank` → `rank`. */
function schemaKey(part: string): string {
  return part.charAt(0).toLowerCase() + part.slice(1);
}

function readTeam(read: (name: string) => string, team: PreparationTeam): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const part of [...TEAM_NUMBER_PARTS, ...TEAM_TEXT_PARTS]) {
    values[schemaKey(part)] = read(teamFieldName(team, part));
  }
  values.alreadyRefereed = read(teamFieldName(team, TEAM_REFEREED_PART)) === CHECKBOX_ON;
  return values;
}

/**
 * Objet attendu par les schémas de préparation, lu champ par champ (`read` renvoie la
 * chaîne d'un champ HTML, vide s'il est absent) ; rien n'est validé ici.
 */
export function preparationInput(read: (name: string) => string): Record<string, unknown> {
  return {
    teamCount: read(TEAM_COUNT_FIELD),
    team1: readTeam(read, "team1"),
    team2: readTeam(read, "team2"),
    crew: Object.fromEntries(CREW_FIELDS.map((field) => [field, read(field)])),
    observed: read(OBSERVED_FIELD) === CHECKBOX_ON,
  };
}

export type MergeResult =
  | { status: "merged"; preparation: PreparationForm }
  /** Champs (noms HTML) à signaler : rien ne doit être écrit. */
  | { status: "conflict"; conflicts: string[] };

/**
 * Fusionne la saisie (`mine`) et la préparation enregistrée (`current`) à partir des
 * valeurs de départ du formulaire (`base`). Voir l'en-tête du fichier.
 */
export function mergePreparation(input: {
  base: PreparationForm;
  mine: PreparationForm;
  current: PreparationForm;
}): MergeResult {
  const base = preparationValues(input.base);
  const mine = preparationValues(input.mine);
  const current = preparationValues(input.current);
  const merged: Record<string, string> = {};
  const conflicts: string[] = [];
  const changedElsewhere: string[] = [];
  for (const name of PREPARATION_FIELDS) {
    const baseValue = base[name] ?? "";
    const mineValue = mine[name] ?? "";
    const currentValue = current[name] ?? "";
    const mineChanged = mineValue !== baseValue;
    const changedSinceBase = currentValue !== baseValue;
    if (changedSinceBase) {
      changedElsewhere.push(name);
    }
    if (mineChanged && changedSinceBase && mineValue !== currentValue) {
      conflicts.push(name);
    }
    merged[name] = mineChanged ? mineValue : currentValue;
  }
  if (conflicts.length > 0) {
    return { status: "conflict", conflicts };
  }
  const parsed = preparationFormSchema.safeParse(preparationInput((name) => merged[name] ?? ""));
  if (parsed.success) {
    return { status: "merged", preparation: parsed.data };
  }
  // Sans modification ailleurs, la fusion est la saisie, déjà validée : ce cas ne se
  // présente pas, mais il ne doit jamais renvoyer un conflit sans champ à signaler.
  return changedElsewhere.length > 0
    ? { status: "conflict", conflicts: changedElsewhere }
    : { status: "merged", preparation: input.mine };
}
