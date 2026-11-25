/**
 * Lecture des champs du formulaire d'indemnité pour le récapitulatif en direct (bloc 10).
 * Pur : prend une fonction de lecture (`FormData.get` ou valeurs de départ), aucun DOM ici.
 * Mêmes règles que le serveur : salle principale du club de l'équipe 1, sauf autre salle
 * choisie (liste « Salle ») ou exception cochée.
 */
import { MAIN_VENUE, NEW_CHOICE, OTHER_VENUE } from "@/lib/compensation-form-fields";
import { departmentFromPostalCode } from "@/lib/payers";
import { gameAmountSchema } from "@/lib/schemas/scales";
import type { DepartmentCode } from "@/lib/payers";
import type { CompensationFormData } from "@/server/compensation/form-data";
import { MAX_GAME_COUNT } from "@/server/compensation/amount";
import type { PreviewInput } from "@/server/compensation/preview";

export type FormPreview = PreviewInput & {
  /** Noms des équipes (club existant ou nouveau), `null` tant qu'ils manquent. */
  team1Name: string | null;
  team2Name: string | null;
  /** Barème choisi, pour l'afficher. */
  scaleName: string | null;
};

type Read = (name: string) => string;

function teamName(
  read: Read,
  prefix: "team1" | "team2",
  data: CompensationFormData,
): string | null {
  const club = read(`${prefix}Club`);
  if (club === NEW_CHOICE) {
    const name = read(`${prefix}Name`).trim();
    return name === "" ? null : name;
  }
  return data.clubs.find((candidate) => candidate.id === club)?.name ?? null;
}

/** Code postal et pays saisis pour une nouvelle adresse (préfixe `team1` ou `venue`). */
function typedAddress(read: Read, prefix: "team1" | "venue"): PreviewInput["venue"] {
  const postalCode = read(`${prefix}PostalCode`).trim();
  if (postalCode === "") {
    return null;
  }
  const country = read(`${prefix}Country`).trim();
  return { postalCode, country: country === "" ? null : country };
}

/**
 * Adresse du match choisie dans le formulaire : salle principale du club de l'équipe 1
 * (`team1`), une adresse connue par son identifiant (autre salle du club, adresse de la
 * liste), ou une nouvelle adresse saisie. Même lecture que le serveur.
 */
type VenueChoice = { kind: "team1" } | { kind: "known"; addressId: string } | { kind: "new" };

function venueChoice(read: Read): VenueChoice {
  // Vide : pas de liste « Salle » (club à une seule salle), la case d'exception décide.
  const clubVenue = read("venueClub");
  if (clubVenue === MAIN_VENUE || (clubVenue === "" && read("venueException") !== "on")) {
    return { kind: "team1" };
  }
  if (clubVenue !== "" && clubVenue !== OTHER_VENUE) {
    return { kind: "known", addressId: clubVenue };
  }
  const address = read("venueAddress");
  return address === NEW_CHOICE ? { kind: "new" } : { kind: "known", addressId: address };
}

function venue(read: Read, data: CompensationFormData): PreviewInput["venue"] {
  const choice = venueChoice(read);
  if (choice.kind === "new") {
    return typedAddress(read, "venue");
  }
  if (choice.kind === "known") {
    const known = data.addresses.find((candidate) => candidate.id === choice.addressId);
    return known === undefined ? null : { postalCode: known.postalCode, country: known.country };
  }
  // Cas normal : l'adresse du club de l'équipe 1, existant ou nouveau.
  const club = read("team1Club");
  if (club === NEW_CHOICE) {
    return typedAddress(read, "team1");
  }
  const known = data.clubs.find((candidate) => candidate.id === club);
  return known === undefined
    ? null
    : { postalCode: known.address.postalCode, country: known.address.country };
}

/**
 * Département de l'adresse du match en cours de saisie, ou `null` (pas encore connue, à
 * l'étranger) : il donne son nom à un niveau de coupe dans la liste (§15.4.6).
 */
export function matchDepartment(read: Read, data: CompensationFormData): DepartmentCode | null {
  const place = venue(read, data);
  return place === null ? null : departmentFromPostalCode(place.postalCode, place.country);
}

/** Nombre de matchs choisi dans la liste d'un plateau (§15.4.7), `null` s'il ne l'est pas. */
function gameCountOf(value: string): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= MAX_GAME_COUNT ? count : null;
}

/** Montant par match saisi pour un plateau (§15.4.7), en centimes, ou `null`. */
function plateauGameCentsOf(value: string): number | null {
  const parsed = gameAmountSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function previewInputFromForm(read: Read, data: CompensationFormData): FormPreview {
  const scaleId = read("scaleId");
  const division = data.divisions.find((candidate) => candidate.id === read("divisionId"));
  return {
    date: read("date"),
    time: read("time"),
    category: division?.category ?? null,
    rates: data.ratesByScale[scaleId] ?? [],
    oneWayDistance: read("oneWayDistance"),
    travelShared: read("travelShared") === "on",
    gameCount: division?.plateau === true ? gameCountOf(read("gameCount")) : 1,
    plateauGameCents:
      division?.plateau === true ? plateauGameCentsOf(read("plateauGameAmount")) : null,
    payerChoice: read("payer"),
    venue: venue(read, data),
    team1Name: teamName(read, "team1", data),
    team2Name: division?.plateau === true ? null : teamName(read, "team2", data),
    plateau: division?.plateau === true,
    scaleName: data.scales.find((scale) => scale.id === scaleId)?.name ?? null,
  };
}

/**
 * Identifiant de l'adresse du match si elle est déjà connue (salle d'un club existant de
 * l'équipe 1 ou adresse choisie dans la liste), sinon `null` (nouveau club, nouvelle
 * adresse, rien choisi).
 */
function venueAddressId(read: Read, data: CompensationFormData): string | null {
  const choice = venueChoice(read);
  if (choice.kind === "new") {
    return null;
  }
  if (choice.kind === "known") {
    const { addressId } = choice;
    return data.addresses.some((candidate) => candidate.id === addressId) ? addressId : null;
  }
  const club = data.clubs.find((candidate) => candidate.id === read("team1Club"));
  return club?.address.id ?? null;
}

/**
 * Doublé probable (§15.4.5) : une autre indemnité existe le même jour à la même adresse.
 * L'indemnité en cours de modification (`compensationId`) ne compte pas.
 */
export function hasSameDayMatch(read: Read, data: CompensationFormData): boolean {
  const day = read("date");
  const addressId = venueAddressId(read, data);
  if (day === "" || addressId === null) {
    return false;
  }
  const self = read("compensationId");
  return data.matchDayVenues.some(
    (other) => other.day === day && other.addressId === addressId && other.compensationId !== self,
  );
}

/** Lecteur sur un `FormData` : un champ absent ou un fichier vaut une chaîne vide. */
export function readFormData(formData: FormData): Read {
  return (name) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
}
