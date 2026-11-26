/**
 * Formulaire de préparation d'un match (§15.4.10) : lecture du FormData, validation Zod,
 * puis service ; suppression ; « Préparer le match » depuis une indemnité ; valeurs de
 * départ du formulaire. Ni Next.js ni authentification ici (§6.2).
 *
 * Champs HTML : `gameId` (caché), `teamCount` (nombre d'équipes de la poule, commun aux
 * deux équipes), par équipe `team1Rank`, `team1Wins`, `team1Losses`, `team1Players`,
 * `team1Coaches`, `team1AlreadyRefereed` (case), idem pour `team2…`, puis `placement`,
 * `communication`, `management`, `table`, `contact` et `observed` (case). Chaque champ a
 * son jumeau caché `base.…` (valeur de départ) : l'enregistrement se fait champ par champ
 * (voir `preparation-values.ts`).
 */
import { z } from "zod";
import { readText } from "@/lib/form-data";
import {
  CREW_FIELDS,
  PREPARATION_TEAMS,
  TEAM_COUNT_FIELD,
  baseFieldName,
} from "@/lib/preparation-form-fields";
import type { CrewField, PreparationTeam } from "@/lib/preparation-form-fields";
import { preparationFieldsSchema, preparationFormSchema } from "@/lib/schemas/preparations";
import type { PreparationForm, TeamPreparation } from "@/lib/schemas/preparations";
import { softDeletePreparation } from "../db/preparations";
import { prepareFromCompensation, saveGamePreparation } from "./manage-preparation";
import type { SavePreparationResult } from "./manage-preparation";
import { preparationInput, preparationValues } from "./preparation-values";
import type { GameDeps } from "./rejection";

/** Champ en erreur : nom du champ HTML (`team1Rank`, `placement`…). */
type PreparationIssue = "invalid" | "rank_above_count";

export type PreparationFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      /** Champ HTML → code d'erreur. */
      fields: Readonly<Record<string, PreparationIssue>>;
      empty: boolean;
    }
  | SavePreparationResult;

export type DeletePreparationState =
  { status: "idle" } | { status: "deleted" } | { status: "not_found" };

export type PrepareMatchState = { status: "idle" } | { status: "not_found" | "limit_reached" };

/**
 * Reconstruit l'objet attendu par les schémas de préparation : la saisie, ou avec
 * `fieldName = baseFieldName` les valeurs de départ. Rien n'est validé ici.
 */
export function readPreparationFormData(
  formData: FormData,
  fieldName: (name: string) => string = (name) => name,
): Record<string, unknown> {
  return preparationInput((name) => readText(formData, fieldName(name)) ?? "");
}

function isTeam(value: unknown): value is PreparationTeam {
  return PREPARATION_TEAMS.some((team) => team === value);
}

function isCrewField(value: unknown): value is CrewField {
  return CREW_FIELDS.some((field) => field === value);
}

/** Nom du champ HTML désigné par le chemin d'une erreur Zod, ou `null`. */
function fieldOfPath(path: readonly PropertyKey[]): string | null {
  const [top, key] = path;
  if (top === TEAM_COUNT_FIELD) {
    return TEAM_COUNT_FIELD;
  }
  if (isTeam(top) && typeof key === "string") {
    return `${top}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  }
  if (top === "crew" && isCrewField(key)) {
    return key;
  }
  return null;
}

function invalidState(error: z.ZodError): PreparationFormState {
  const fields: Record<string, PreparationIssue> = {};
  let empty = false;
  for (const issue of error.issues) {
    if (issue.message === "empty_preparation") {
      empty = true;
      continue;
    }
    const field = fieldOfPath(issue.path);
    if (field !== null) {
      fields[field] = issue.message === "rank_above_count" ? "rank_above_count" : "invalid";
    }
  }
  return { status: "invalid", fields, empty };
}

const idSchema = z.uuid();

/** Enregistrement validé : match visé, saisie et valeurs de départ du formulaire. */
type ParsedSave = { gameId: string; preparation: PreparationForm; base: PreparationForm };

/**
 * Lit et valide un enregistrement de préparation (champ caché `gameId`, saisie, valeurs de
 * départ `base.…`) : l'enregistrement à faire, ou l'état d'erreur à afficher.
 */
export function parsePreparationSave(formData: FormData): ParsedSave | PreparationFormState {
  const gameId = idSchema.safeParse(readText(formData, "gameId"));
  if (!gameId.success) {
    return { status: "not_found" };
  }
  const parsed = preparationFormSchema.safeParse(readPreparationFormData(formData));
  if (!parsed.success) {
    return invalidState(parsed.error);
  }
  // Valeurs de départ : celles affichées à l'ouverture, donc déjà valides (sans les règles
  // d'ensemble : une préparation pas encore écrite est vide). Invalides = formulaire bricolé.
  const base = preparationFieldsSchema.safeParse(readPreparationFormData(formData, baseFieldName));
  if (!base.success) {
    return { status: "invalid", fields: {}, empty: false };
  }
  return { gameId: gameId.data, preparation: parsed.data, base: base.data };
}

/** Valide puis enregistre la préparation du match désigné par le champ caché `gameId`. */
export async function handleSavePreparation(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<PreparationFormState> {
  const save = parsePreparationSave(formData);
  if ("status" in save) {
    return save;
  }
  return saveGamePreparation(deps, userId, save.gameId, save);
}

/** Supprime (soft delete) la préparation du match désigné par le champ caché `gameId`. */
export async function handleDeletePreparation(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<DeletePreparationState> {
  const gameId = idSchema.safeParse(readText(formData, "gameId"));
  if (!gameId.success) {
    return { status: "not_found" };
  }
  const deleted = await deps.transaction((db) =>
    softDeletePreparation(db, { userId, gameId: gameId.data }),
  );
  return deleted ? { status: "deleted" } : { status: "not_found" };
}

/**
 * « Préparer le match » depuis une indemnité (champ caché `compensationId`) : identifiant
 * du match à préparer (créé si besoin), ou l'état d'erreur à afficher.
 */
export async function handlePrepareMatch(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<{ status: "ready"; gameId: string } | PrepareMatchState> {
  const compensationId = idSchema.safeParse(readText(formData, "compensationId"));
  if (!compensationId.success) {
    return { status: "not_found" };
  }
  const result = await prepareFromCompensation(deps, userId, compensationId.data);
  // Un plateau n'affiche pas le bouton : une requête bricolée reçoit « introuvable ».
  return result.status === "plateau" ? { status: "not_found" } : result;
}

/** Ce qui pré-coche les cases d'une préparation pas encore enregistrée. */
export type PreparationDefaults = {
  /** Calcul « déjà arbitrée cette saison » (§15.4.10). */
  alreadyRefereed: { team1: boolean; team2: boolean };
  /** Un observateur est saisi sur le match. */
  hasObserver: boolean;
};

const EMPTY_TEAM: TeamPreparation = {
  rank: null,
  wins: null,
  losses: null,
  players: null,
  coaches: null,
  alreadyRefereed: false,
};

/**
 * Valeurs de départ du formulaire : la préparation enregistrée (ses cases priment), sinon
 * des champs vides avec les cases pré-cochées par le calcul et l'observateur du match.
 */
export function preparationFormValues(
  preparation: PreparationForm | null,
  defaults: PreparationDefaults,
): Record<string, string> {
  return preparationValues(
    preparation ?? {
      teamCount: null,
      team1: { ...EMPTY_TEAM, alreadyRefereed: defaults.alreadyRefereed.team1 },
      team2: { ...EMPTY_TEAM, alreadyRefereed: defaults.alreadyRefereed.team2 },
      crew: { placement: null, communication: null, management: null, table: null, contact: null },
      observed: defaults.hasObserver,
    },
  );
}
