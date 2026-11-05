/**
 * Formulaire d'indemnité (saisie et modification) : lecture du FormData, validation
 * Zod, puis enregistrement ; suppression. Ni Next.js ni authentification ici : la Server Action vérifie la session et
 * passe l'utilisateur (§6.2). Le propriétaire ne vient jamais du formulaire.
 *
 * Champs du formulaire HTML :
 * - date, time, divisionId, scaleId, oneWayDistance ;
 * - team1Club / team2Club : identifiant d'un club, ou `new` (champs teamN* d'un nouveau club) ;
 * - venueException : case « autre adresse que celle de l'équipe 1 » ;
 *   venueAddress : identifiant d'une adresse connue, ou `new` (champs venue*).
 */
import { z } from "zod";
import {
  COMPENSATION_FIELDS,
  NEW_CHOICE,
  type AddressPart,
  type CompensationField,
} from "@/lib/compensation-form-fields";
import { toParisIsoDate } from "@/lib/dates";
import { oneWayKmInput } from "@/lib/distance";
import { toParisTimeOfDay } from "@/lib/paris-time";
import { compensationFormSchema } from "@/lib/schemas/compensations";
import { softDeleteCompensation } from "../db/compensations";
import type { CompensationForEdit } from "../db/compensations";
import type { CompensationAmount } from "./amount";
import { createCompensation, updateCompensation } from "./create-compensation";
import type { CompensationDeps, CreateCompensationRejection } from "./create-compensation";

type Prefix = "team1" | "team2" | "venue";

/** État du formulaire d'indemnité, en création comme en modification (`useActionState`). */
export type CompensationFormState =
  | { status: "idle" }
  | { status: "invalid"; fields: CompensationField[] }
  | CreateCompensationRejection
  | { status: "created"; amount: CompensationAmount }
  | { status: "updated"; amount: CompensationAmount };

export type DeleteCompensationState =
  { status: "idle" } | { status: "deleted" } | { status: "not_found" };

/** Valeur texte d'un champ ; un fichier ou un champ absent devient `undefined` (refusé par Zod). */
function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Nom du champ HTML d'une partie d'adresse : `team1` + `postalCode` → `team1PostalCode`. */
const ADDRESS_INPUT_SUFFIX: Record<AddressPart, string> = {
  street: "Street",
  number: "Number",
  postalCode: "PostalCode",
  city: "City",
  country: "Country",
};

function readAddress(formData: FormData, prefix: Prefix): Record<AddressPart, string | undefined> {
  const field = (part: AddressPart): string | undefined =>
    text(formData, `${prefix}${ADDRESS_INPUT_SUFFIX[part]}`);
  return {
    street: field("street"),
    // Champs facultatifs : absents du formulaire, ils valent une saisie vide.
    number: field("number") ?? "",
    postalCode: field("postalCode"),
    city: field("city"),
    country: field("country") ?? "",
  };
}

function readTeam(formData: FormData, prefix: "team1" | "team2"): Record<string, unknown> {
  const club = text(formData, `${prefix}Club`);
  if (club === NEW_CHOICE) {
    return {
      kind: "new",
      name: text(formData, `${prefix}Name`),
      address: readAddress(formData, prefix),
    };
  }
  return { kind: "existing", clubId: club };
}

function readVenue(formData: FormData): Record<string, unknown> {
  // Case non cochée : l'adresse est celle du club de l'équipe 1 (cas normal).
  if (text(formData, "venueException") !== "on") {
    return { kind: "team1" };
  }
  const address = text(formData, "venueAddress");
  if (address === NEW_CHOICE) {
    return { kind: "new", address: readAddress(formData, "venue") };
  }
  return { kind: "existing", addressId: address };
}

/** Reconstruit l'objet attendu par `compensationFormSchema` ; rien n'est validé ici. */
export function readCompensationFormData(formData: FormData): Record<string, unknown> {
  return {
    date: text(formData, "date"),
    time: text(formData, "time"),
    divisionId: text(formData, "divisionId"),
    scaleId: text(formData, "scaleId"),
    team1: readTeam(formData, "team1"),
    team2: readTeam(formData, "team2"),
    venue: readVenue(formData),
    oneWayDistance: text(formData, "oneWayDistance"),
  };
}

function isField(value: string): value is CompensationField {
  return COMPENSATION_FIELDS.some((field) => field === value);
}

/**
 * Champ du formulaire concerné par une erreur Zod. Un champ d'adresse (`team1.address.city`)
 * devient `team1.city` ; un identifiant ou un choix invalide désigne la liste entière.
 */
export function fieldOfIssuePath(path: readonly PropertyKey[]): CompensationField | null {
  const [top, ...rest] = path.map(String);
  if (top === undefined) {
    return null;
  }
  if (top === "team1" || top === "team2" || top === "venue") {
    const last = rest[rest.length - 1];
    const candidate = rest[0] === "address" || rest[0] === "name" ? `${top}.${last ?? ""}` : top;
    return isField(candidate) ? candidate : top;
  }
  return isField(top) ? top : null;
}

function invalidFields(error: z.ZodError): CompensationField[] {
  const failed = new Set<CompensationField>();
  for (const issue of error.issues) {
    const field = fieldOfIssuePath(issue.path);
    if (field !== null) {
      failed.add(field);
    }
  }
  return COMPENSATION_FIELDS.filter((field) => failed.has(field));
}

/** Valide le formulaire puis crée l'indemnité de `userId`. */
export async function handleCreateCompensation(
  deps: CompensationDeps,
  userId: string,
  formData: FormData,
): Promise<CompensationFormState> {
  const parsed = compensationFormSchema.safeParse(readCompensationFormData(formData));
  if (!parsed.success) {
    return { status: "invalid", fields: invalidFields(parsed.error) };
  }
  const result = await createCompensation(deps, userId, parsed.data);
  return result.status === "created" ? { status: "created", amount: result.amount } : result;
}

const compensationIdSchema = z.uuid();

/**
 * Valide le formulaire puis modifie l'indemnité désignée par le champ caché
 * `compensationId`. Le service vérifie qu'elle appartient à `userId` : l'identifiant
 * venant du navigateur, il n'est jamais cru sur parole.
 */
export async function handleUpdateCompensation(
  deps: CompensationDeps,
  userId: string,
  formData: FormData,
): Promise<CompensationFormState> {
  const compensationId = compensationIdSchema.safeParse(text(formData, "compensationId"));
  if (!compensationId.success) {
    return { status: "not_found", field: "compensation" };
  }
  const parsed = compensationFormSchema.safeParse(readCompensationFormData(formData));
  if (!parsed.success) {
    return { status: "invalid", fields: invalidFields(parsed.error) };
  }
  return updateCompensation(deps, userId, compensationId.data, parsed.data);
}

/** Supprime (soft delete) une indemnité de `userId`. */
export async function handleDeleteCompensation(
  deps: CompensationDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteCompensationState> {
  const compensationId = compensationIdSchema.safeParse(text(formData, "compensationId"));
  if (!compensationId.success) {
    return { status: "not_found" };
  }
  const deleted = await deps.transaction((db) =>
    softDeleteCompensation(db, { compensationId: compensationId.data, userId }),
  );
  return deleted ? { status: "deleted" } : { status: "not_found" };
}

/**
 * Valeurs du formulaire pour modifier une indemnité : mêmes noms de champs que la
 * saisie. L'adresse du match n'est une « exception » que si elle diffère de celle du
 * club de l'équipe 1.
 */
export function compensationFormValues(compensation: CompensationForEdit): Record<string, string> {
  const values: Record<string, string> = {
    compensationId: compensation.id,
    date: toParisIsoDate(compensation.startsAt),
    time: toParisTimeOfDay(compensation.startsAt),
    divisionId: compensation.divisionId,
    scaleId: compensation.scaleId,
    team1Club: compensation.team1ClubId,
    team2Club: compensation.team2ClubId,
    oneWayDistance: oneWayKmInput(compensation.distanceM),
  };
  if (compensation.addressId !== compensation.team1AddressId) {
    values.venueException = "on";
    values.venueAddress = compensation.addressId;
  }
  return values;
}
