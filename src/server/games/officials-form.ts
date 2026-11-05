/**
 * Formulaire des officiels (bloc 9) : création du match depuis une indemnité et
 * modification des officiels. Lecture du FormData, validation Zod, puis service.
 * Ni Next.js ni authentification ici : la Server Action vérifie la session (§6.2).
 *
 * Champs HTML, pour chaque place (`referee1`, `referee2`, `referee3`, `observer`) :
 * - `<place>Person` : `none`, `self`, `new` ou l'identifiant d'un collègue ;
 * - pour `new` : `<place>Firstname`, `<place>Lastname`, `<place>HasAccount` (case).
 * Champ caché : `compensationId` (création) ou `gameId` (modification).
 */
import { z } from "zod";
import { PERSON_NEW, PERSON_NONE, PERSON_SELF, officialFieldName } from "@/lib/game-form-fields";
import { OFFICIAL_SLOTS, officialsSchema } from "@/lib/schemas/officials";
import type { OfficialSlot, OfficialsIssueCode } from "@/lib/schemas/officials";
import type { PersonSummary } from "../db/persons";
import { createGameFromCompensation, updateOfficials } from "./manage-game";
import type { GameDeps, GameRejection } from "./rejection";

/** Erreur d'une place : règle de composition, liste ou nom invalide. */
export type OfficialsFieldError = OfficialsIssueCode | "invalid_choice" | "invalid_name";

export type OfficialsFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<OfficialSlot, OfficialsFieldError>> }
  | GameRejection
  | { status: "created"; gameId: string }
  | { status: "updated" };

const ISSUE_CODES: readonly string[] = [
  "referee1_required",
  "referee3_without_referee2",
  "self_missing",
  "self_twice",
  "person_twice",
] satisfies OfficialsIssueCode[];

function isIssueCode(value: string): value is OfficialsIssueCode {
  return ISSUE_CODES.includes(value);
}

function isSlot(value: string): value is OfficialSlot {
  return OFFICIAL_SLOTS.some((slot) => slot === value);
}

/** Valeur texte d'un champ ; un fichier ou un champ absent devient `undefined` (refusé par Zod). */
function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function readSlot(formData: FormData, slot: OfficialSlot): Record<string, unknown> {
  const person = text(formData, officialFieldName(slot, "Person"));
  switch (person) {
    case PERSON_NONE:
      return { kind: "none" };
    case PERSON_SELF:
      return { kind: "self" };
    case PERSON_NEW:
      return {
        kind: "new",
        colleague: {
          firstname: text(formData, officialFieldName(slot, "Firstname")) ?? "",
          lastname: text(formData, officialFieldName(slot, "Lastname")),
          hasAccount: text(formData, officialFieldName(slot, "HasAccount")) === "on",
        },
      };
    default:
      return { kind: "existing", personId: person };
  }
}

/** Reconstruit l'objet attendu par `officialsSchema` ; rien n'est validé ici. */
export function readOfficialsFormData(formData: FormData): Record<OfficialSlot, unknown> {
  return {
    referee1: readSlot(formData, "referee1"),
    referee2: readSlot(formData, "referee2"),
    referee3: readSlot(formData, "referee3"),
    observer: readSlot(formData, "observer"),
  };
}

/** Une erreur par place (la première) : règle de composition, nom ou choix invalide. */
export function officialsErrors(
  error: z.ZodError,
): Partial<Record<OfficialSlot, OfficialsFieldError>> {
  const errors: Partial<Record<OfficialSlot, OfficialsFieldError>> = {};
  for (const issue of error.issues) {
    const [top, second] = issue.path.map(String);
    if (top === undefined || !isSlot(top) || errors[top] !== undefined) {
      continue;
    }
    if (isIssueCode(issue.message)) {
      errors[top] = issue.message;
    } else {
      errors[top] = second === "colleague" ? "invalid_name" : "invalid_choice";
    }
  }
  return errors;
}

const idSchema = z.uuid();

/** Valide le formulaire puis crée le match de l'indemnité (champ caché `compensationId`). */
export async function handleCreateGame(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<OfficialsFormState> {
  const compensationId = idSchema.safeParse(text(formData, "compensationId"));
  if (!compensationId.success) {
    return { status: "not_found", field: "compensation" };
  }
  const parsed = officialsSchema.safeParse(readOfficialsFormData(formData));
  if (!parsed.success) {
    return { status: "invalid", errors: officialsErrors(parsed.error) };
  }
  return createGameFromCompensation(deps, userId, compensationId.data, parsed.data);
}

/**
 * Valide le formulaire puis remplace les officiels du match désigné par le champ caché
 * `gameId`. Le service vérifie qu'il appartient à `userId`.
 */
export async function handleUpdateOfficials(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<OfficialsFormState> {
  const gameId = idSchema.safeParse(text(formData, "gameId"));
  if (!gameId.success) {
    return { status: "not_found", field: "game" };
  }
  const parsed = officialsSchema.safeParse(readOfficialsFormData(formData));
  if (!parsed.success) {
    return { status: "invalid", errors: officialsErrors(parsed.error) };
  }
  return updateOfficials(deps, userId, gameId.data, parsed.data);
}

/** Valeurs de départ du formulaire : la personne de chaque place, ou `none`. */
export function officialsFormValues(
  officials: Record<OfficialSlot, PersonSummary | null>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const slot of OFFICIAL_SLOTS) {
    const person = officials[slot];
    values[officialFieldName(slot, "Person")] =
      person === null ? PERSON_NONE : person.isSelf ? PERSON_SELF : person.id;
  }
  return values;
}

/** Composition proposée pour un nouveau match : l'utilisateur arbitre 1, le reste vide. */
export const DEFAULT_OFFICIALS_VALUES: Readonly<Record<string, string>> = {
  [officialFieldName("referee1", "Person")]: PERSON_SELF,
  [officialFieldName("referee2", "Person")]: PERSON_NONE,
  [officialFieldName("referee3", "Person")]: PERSON_NONE,
  [officialFieldName("observer", "Person")]: PERSON_NONE,
};
