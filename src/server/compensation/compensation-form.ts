/**
 * Formulaire d'indemnité (saisie et modification) : lecture du FormData, validation
 * Zod, puis enregistrement ; suppression. Ni Next.js ni authentification ici : la Server Action vérifie la session et
 * passe l'utilisateur (§6.2). Le propriétaire ne vient jamais du formulaire.
 *
 * Champs du formulaire HTML :
 * - date, time, divisionId, scaleId, oneWayDistance ;
 * - cupRound : tour, pour un niveau de coupe seulement (§15.4.6) ;
 * - payer : organisme qui verse, vide = déduit du niveau et de l'adresse (bloc 10) ;
 * - team1Club / team2Club : identifiant d'un club, ou `new` (teamNName et teamNPostalCode
 *   d'un nouveau club, §15.4.1 ; teamNVenue, teamNStreet, teamNNumber, teamNCity et
 *   teamNVenues, liste JSON de ses autres salles, s'il vient de l'annuaire FFBB) ;
 * - venueClub : liste « Salle » d'un club de l'équipe 1 à plusieurs salles (`main` = salle
 *   principale, identifiant d'une autre salle, ou `other`) ; sinon venueException, case
 *   « autre adresse que celle de l'équipe 1 ». Pour une autre adresse : venueAddress,
 *   identifiant d'une adresse connue, ou `new` (champs venue*, dont venueName) ;
 * - travelShared : case « doublé », déplacement déjà compté sur un autre match (§15.4.5) ;
 * - gameCount, plateauGameAmount : nombre de matchs et montant par match (euros) d'un
 *   plateau (§15.4.7), dont la liste team2Club est alors absente (club organisateur seul).
 */
import { z } from "zod";
import {
  COMPENSATION_FIELDS,
  NEW_CHOICE,
  MAIN_VENUE,
  OTHER_VENUE,
  type AddressPart,
  type CompensationField,
} from "@/lib/compensation-form-fields";
import { toParisIsoDate } from "@/lib/dates";
import { readJsonList, readJsonValue, readText } from "@/lib/form-data";
import { oneWayKmInput } from "@/lib/distance";
import { toParisTimeOfDay } from "@/lib/paris-time";
import { compensationFormSchema } from "@/lib/schemas/compensations";
import { softDeleteCompensation } from "../db/compensation-writes";
import type { CompensationForEdit, CupFinal } from "../db/compensations";
import type { CompensationAmount } from "./amount";
import { createCompensation, updateCompensation } from "./create-compensation";
import type { CompensationDeps, CreateCompensationRejection } from "./create-compensation";

/** État du formulaire d'indemnité, en création comme en modification (`useActionState`). */
export type CompensationFormState =
  | { status: "idle" }
  | { status: "invalid"; fields: CompensationField[] }
  | CreateCompensationRejection
  /**
   * `firstOfSeason` : saison FFBB à fêter (première indemnité de la saison), sinon `null`.
   * `final` : finale de coupe tout juste enregistrée (§15.4.6), sinon `null`.
   */
  | {
      status: "created";
      amount: CompensationAmount;
      firstOfSeason: number | null;
      final: CupFinal | null;
    }
  | { status: "updated"; amount: CompensationAmount; final: CupFinal | null };

export type DeleteCompensationState =
  { status: "idle" } | { status: "deleted" } | { status: "not_found" };

/** Nom du champ HTML d'une partie d'adresse : `team1` + `postalCode` → `team1PostalCode`. */
const ADDRESS_INPUT_SUFFIX: Record<AddressPart, string> = {
  street: "Street",
  number: "Number",
  postalCode: "PostalCode",
  city: "City",
  country: "Country",
};

function readAddress(
  formData: FormData,
  prefix: "venue",
): Record<AddressPart | "name", string | undefined> {
  const field = (part: AddressPart): string | undefined =>
    readText(formData, `${prefix}${ADDRESS_INPUT_SUFFIX[part]}`);
  return {
    name: readText(formData, `${prefix}Name`) ?? "",
    street: field("street"),
    // Champs facultatifs : absents du formulaire, ils valent une saisie vide.
    number: field("number") ?? "",
    postalCode: field("postalCode"),
    city: field("city"),
    country: field("country") ?? "",
  };
}

function readTeam(formData: FormData, prefix: "team1" | "team2"): Record<string, unknown> | null {
  const club = readText(formData, `${prefix}Club`);
  // Liste de l'équipe 2 absente : plateau, club organisateur seul (§15.4.7).
  if (club === undefined && prefix === "team2") {
    return null;
  }
  if (club === NEW_CHOICE) {
    // Nouveau club : nom et code postal (§15.4.1) ; nom de la salle, rue, numéro, ville et
    // autres salles en plus s'il a été choisi dans l'annuaire FFBB (champs absents sinon).
    return {
      kind: "new",
      name: readText(formData, `${prefix}Name`),
      postalCode: readText(formData, `${prefix}PostalCode`),
      street: readText(formData, `${prefix}Street`),
      number: readText(formData, `${prefix}Number`),
      city: readText(formData, `${prefix}City`),
      venueName: readText(formData, `${prefix}Venue`),
      venues: readJsonList(formData, `${prefix}Venues`),
      ffbb: readJsonValue(formData, `${prefix}Ffbb`),
    };
  }
  return { kind: "existing", clubId: club };
}

function readVenue(formData: FormData): Record<string, unknown> {
  const clubVenue = readText(formData, "venueClub");
  // Club à plusieurs salles : la liste « Salle » remplace la case d'exception.
  if (clubVenue !== undefined && clubVenue !== OTHER_VENUE) {
    return clubVenue === MAIN_VENUE
      ? { kind: "team1" }
      : { kind: "existing", addressId: clubVenue };
  }
  // Case non cochée : l'adresse est la salle principale du club de l'équipe 1 (cas normal).
  if (clubVenue === undefined && readText(formData, "venueException") !== "on") {
    return { kind: "team1" };
  }
  const address = readText(formData, "venueAddress");
  if (address === NEW_CHOICE) {
    return { kind: "new", address: readAddress(formData, "venue") };
  }
  return { kind: "existing", addressId: address };
}

/** Reconstruit l'objet attendu par `compensationFormSchema` ; rien n'est validé ici. */
export function readCompensationFormData(formData: FormData): Record<string, unknown> {
  return {
    date: readText(formData, "date"),
    time: readText(formData, "time"),
    divisionId: readText(formData, "divisionId"),
    // Liste absente hors coupe : pas de tour.
    cupRound: readText(formData, "cupRound") ?? "",
    scaleId: readText(formData, "scaleId"),
    payer: readText(formData, "payer") ?? "",
    team1: readTeam(formData, "team1"),
    team2: readTeam(formData, "team2"),
    venue: readVenue(formData),
    oneWayDistance: readText(formData, "oneWayDistance"),
    // Case à cocher : absente du FormData quand elle n'est pas cochée.
    travelShared: readText(formData, "travelShared") === "on",
    gameCount: readText(formData, "gameCount") ?? "",
    plateauGameAmount: readText(formData, "plateauGameAmount") ?? "",
  };
}

function isField(value: string): value is CompensationField {
  return COMPENSATION_FIELDS.some((field) => field === value);
}

/** Champs d'un nouveau club (`team1.name`, `team1.city`…), hors liste de choix. */
const NEW_CLUB_PARTS: ReadonlySet<string> = new Set([
  "name",
  "postalCode",
  "street",
  "number",
  "city",
]);

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
    const candidate =
      rest[0] === "address" || (rest[0] !== undefined && NEW_CLUB_PARTS.has(rest[0]))
        ? `${top}.${last ?? ""}`
        : top;
    return isField(candidate) ? candidate : top;
  }
  return isField(top) ? top : null;
}

/** Champs invalides, dans l'ordre du formulaire (aussi utilisé par le match complet, bloc 9). */
export function invalidFields(error: z.ZodError): CompensationField[] {
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
  return result.status === "created"
    ? {
        status: "created",
        amount: result.amount,
        firstOfSeason: result.firstOfSeason,
        final: result.final,
      }
    : result;
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
  const compensationId = compensationIdSchema.safeParse(readText(formData, "compensationId"));
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
  const compensationId = compensationIdSchema.safeParse(readText(formData, "compensationId"));
  if (!compensationId.success) {
    return { status: "not_found" };
  }
  const deleted = await deps.transaction((db) =>
    softDeleteCompensation(db, { compensationId: compensationId.data, userId }),
  );
  return deleted ? { status: "deleted" } : { status: "not_found" };
}

/** Centimes → saisie en euros relue par le formulaire : 1500 → « 15,00 ». */
function centsToEuroInput(cents: number): string {
  return `${String(Math.floor(cents / 100))},${String(cents % 100).padStart(2, "0")}`;
}

/**
 * Valeurs du formulaire pour modifier une indemnité : mêmes noms de champs que la
 * saisie. L'adresse du match n'est une « exception » que si elle diffère de la salle
 * principale du club de l'équipe 1 (le formulaire la retrouve parmi ses autres salles).
 */
export function compensationFormValues(compensation: CompensationForEdit): Record<string, string> {
  const values: Record<string, string> = {
    compensationId: compensation.id,
    date: toParisIsoDate(compensation.startsAt),
    time: toParisTimeOfDay(compensation.startsAt),
    divisionId: compensation.divisionId,
    cupRound: compensation.cupRound ?? "",
    scaleId: compensation.scaleId,
    payer: compensation.payer ?? "",
    team1Club: compensation.team1ClubId,
    team2Club: compensation.team2ClubId ?? "",
    gameCount: compensation.gameCount === null ? "" : String(compensation.gameCount),
    plateauGameAmount:
      compensation.plateauGameCents === null ? "" : centsToEuroInput(compensation.plateauGameCents),
    // Doublé enregistré sans distance : champ vide plutôt que « 0 ».
    oneWayDistance:
      compensation.travelShared && compensation.distanceM === 0
        ? ""
        : oneWayKmInput(compensation.distanceM),
  };
  if (compensation.travelShared) {
    values.travelShared = "on";
  }
  if (compensation.addressId !== compensation.team1AddressId) {
    values.venueException = "on";
    values.venueAddress = compensation.addressId;
  }
  return values;
}
