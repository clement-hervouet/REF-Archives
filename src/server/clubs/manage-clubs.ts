/**
 * Formulaires de l'onglet « Clubs » (§15.4.1) : ajout, modification (nom et salle
 * principale), suppression, puis gestion des autres salles d'un club. Ni Next.js ni
 * authentification ici (§6.2) : le propriétaire vient de la session, jamais du
 * formulaire, et chaque requête filtre sur lui.
 *
 * Champs HTML de la fiche : `name`, `venueName`, `street`, `number`, `postalCode`, `city`,
 * `country`, et à l'ajout `venues` (liste JSON des autres salles importées de l'annuaire
 * FFBB) et `ffbb` (lien FFBB du club, JSON) ; `clubId` (caché) pour modifier ou supprimer.
 */
import { z } from "zod";
import { readJsonList, readJsonValue, readText } from "@/lib/form-data";
import { CLUB_FIELDS, clubFormSchema } from "@/lib/schemas/clubs";
import type { ClubField } from "@/lib/schemas/clubs";
import { clubVenueSchema, clubVenuesSchema } from "@/lib/schemas/compensations";
import { ffbbLinkSchema } from "@/lib/schemas/ffbb-link";
import type { ClubVenue } from "@/lib/schemas/compensations";
import {
  deleteClub,
  detachClubVenue,
  insertClubWithAddress,
  lockClubVenues,
  setClubFfbbLink,
  setMainClubVenue,
  updateClubWithAddress,
} from "../db/clubs";
import type { DeleteClubResult } from "../db/clubs";
import { attachClubVenue, findOrInsertAddress } from "../db/compensation-writes";
import type { Transaction } from "../db/users";

export type ClubDeps = { transaction: Transaction };

export type ClubFormState =
  | { status: "idle" }
  | { status: "invalid"; fields: readonly ClubField[] }
  | { status: "created" }
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "limit_reached" };

export type DeleteClubState = { status: "idle" } | { status: DeleteClubResult };

/** Champ d'une salle saisie à la main, ou `venues` (liste importée de l'annuaire FFBB). */
export type ClubVenueField = "name" | "street" | "number" | "postalCode" | "city" | "venues";

const CLUB_VENUE_FIELDS: readonly ClubVenueField[] = [
  "name",
  "street",
  "number",
  "postalCode",
  "city",
  "venues",
];

/** État des formulaires des salles d'un club (ajout, retrait, salle principale). */
export type ClubVenueState =
  | { status: "idle" }
  | { status: "invalid"; fields: readonly ClubVenueField[] }
  /** `count` : salles rattachées (une salle déjà connue du club ne compte pas). */
  | { status: "added"; count: number }
  | { status: "unchanged" }
  | { status: "full" }
  | { status: "removed" }
  | { status: "main_set" }
  | { status: "not_found" };

const idSchema = z.uuid();

function isClubField(value: unknown): value is ClubField {
  return CLUB_FIELDS.some((field) => field === value);
}

/** Champs refusés, dans l'ordre du formulaire. */
function invalidClubFields(error: z.ZodError): ClubField[] {
  const fields = new Set<ClubField>();
  for (const issue of error.issues) {
    const [field] = issue.path;
    if (isClubField(field)) {
      fields.add(field);
    }
  }
  return CLUB_FIELDS.filter((field) => fields.has(field));
}

/** Reconstruit l'objet attendu par `clubFormSchema` ; un champ facultatif absent vaut "". */
export function readClubFormData(formData: FormData): Record<string, unknown> {
  return {
    name: readText(formData, "name"),
    venueName: readText(formData, "venueName") ?? "",
    street: readText(formData, "street") ?? "",
    number: readText(formData, "number") ?? "",
    postalCode: readText(formData, "postalCode"),
    city: readText(formData, "city") ?? "",
    country: readText(formData, "country") ?? "",
    venues: readJsonList(formData, "venues"),
    ffbb: readJsonValue(formData, "ffbb"),
  };
}

function parseClub(formData: FormData) {
  return clubFormSchema.safeParse(readClubFormData(formData));
}

export async function handleCreateClub(
  deps: ClubDeps,
  userId: string,
  formData: FormData,
): Promise<ClubFormState> {
  const parsed = parseClub(formData);
  if (!parsed.success) {
    return { status: "invalid", fields: invalidClubFields(parsed.error) };
  }
  const clubId = await deps.transaction((db) =>
    insertClubWithAddress(db, { userId, club: parsed.data }),
  );
  return clubId === null ? { status: "limit_reached" } : { status: "created" };
}

export async function handleUpdateClub(
  deps: ClubDeps,
  userId: string,
  formData: FormData,
): Promise<ClubFormState> {
  const clubId = idSchema.safeParse(readText(formData, "clubId"));
  if (!clubId.success) {
    return { status: "not_found" };
  }
  const parsed = parseClub(formData);
  if (!parsed.success) {
    return { status: "invalid", fields: invalidClubFields(parsed.error) };
  }
  const updated = await deps.transaction((db) =>
    updateClubWithAddress(db, { userId, clubId: clubId.data, club: parsed.data }),
  );
  return updated ? { status: "updated" } : { status: "not_found" };
}

export async function handleDeleteClub(
  deps: ClubDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteClubState> {
  const clubId = idSchema.safeParse(readText(formData, "clubId"));
  if (!clubId.success) {
    return { status: "not_found" };
  }
  const result = await deps.transaction((db) => deleteClub(db, { userId, clubId: clubId.data }));
  return { status: result };
}

// ─── Lien avec l'annuaire FFBB ──────────────────────────────────────────────

export type ClubFfbbLinkState = { status: "linked" | "not_found" | "invalid" };

/**
 * Lie un club de l'utilisateur au club choisi dans l'annuaire FFBB (logo, couleur). Un lien
 * ne se retire pas : `link` nul est refusé. Arguments venus du navigateur : validés ici.
 */
export async function handleSetClubFfbbLink(
  deps: ClubDeps,
  userId: string,
  input: { clubId: unknown; link: unknown },
): Promise<ClubFfbbLinkState> {
  const clubId = idSchema.safeParse(input.clubId);
  const link = ffbbLinkSchema.safeParse(input.link);
  if (!clubId.success || !link.success) {
    return { status: "invalid" };
  }
  const updated = await deps.transaction((db) =>
    setClubFfbbLink(db, { userId, clubId: clubId.data, link: link.data }),
  );
  if (!updated) {
    return { status: "not_found" };
  }
  return { status: "linked" };
}

// ─── Salles d'un club ───────────────────────────────────────────────────────

function isClubVenueField(value: unknown): value is ClubVenueField {
  return CLUB_VENUE_FIELDS.some((field) => field === value);
}

/**
 * Salles à ajouter : la liste importée de l'annuaire FFBB (champ `venues`), sinon la salle
 * saisie à la main (`venueName`, `street`, `number`, `postalCode`, `city`).
 */
function parseVenues(
  formData: FormData,
): { ok: true; venues: readonly ClubVenue[] } | { ok: false; fields: ClubVenueField[] } {
  if (formData.has("venues")) {
    const parsed = clubVenuesSchema.safeParse(readJsonList(formData, "venues"));
    return parsed.success ? { ok: true, venues: parsed.data } : { ok: false, fields: ["venues"] };
  }
  const parsed = clubVenueSchema.safeParse({
    name: readText(formData, "venueName") ?? "",
    street: readText(formData, "street") ?? "",
    number: readText(formData, "number") ?? "",
    postalCode: readText(formData, "postalCode"),
    city: readText(formData, "city") ?? "",
  });
  if (parsed.success) {
    return { ok: true, venues: [parsed.data] };
  }
  const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
  return { ok: false, fields: CLUB_VENUE_FIELDS.filter((field) => fields.has(field)) };
}

/**
 * Ajoute des salles au club `clubId` (champ caché) : chacune est retrouvée parmi les
 * adresses de l'utilisateur (même rue, ou même nom) ou créée, puis rattachée. Une salle
 * déjà rattachée, ou la salle principale, ne change rien.
 */
export async function handleAddClubVenues(
  deps: ClubDeps,
  userId: string,
  formData: FormData,
): Promise<ClubVenueState> {
  const clubId = idSchema.safeParse(readText(formData, "clubId"));
  if (!clubId.success) {
    return { status: "not_found" };
  }
  const parsed = parseVenues(formData);
  if (!parsed.ok) {
    return { status: "invalid", fields: parsed.fields.filter(isClubVenueField) };
  }
  return deps.transaction(async (db): Promise<ClubVenueState> => {
    const club = await lockClubVenues(db, { userId, clubId: clubId.data });
    if (club === null) {
      return { status: "not_found" };
    }
    let added = 0;
    for (const venue of parsed.venues) {
      // Club plein : on s'arrête avant de créer une adresse qui ne serait rattachée à rien.
      if (added >= club.free) {
        break;
      }
      const addressId = await findOrInsertAddress(db, {
        userId,
        address: { ...venue, country: null },
      });
      if (await attachClubVenue(db, { userId, clubId: clubId.data, addressId })) {
        added += 1;
      }
    }
    if (added > 0) {
      return { status: "added", count: added };
    }
    return club.free === 0 && parsed.venues.length > 0
      ? { status: "full" }
      : { status: "unchanged" };
  });
}

function readVenueTarget(formData: FormData): { clubId: string; addressId: string } | null {
  const clubId = idSchema.safeParse(readText(formData, "clubId"));
  const addressId = idSchema.safeParse(readText(formData, "addressId"));
  return clubId.success && addressId.success
    ? { clubId: clubId.data, addressId: addressId.data }
    : null;
}

/** Retire une autre salle du club (la principale ne se retire pas). */
export async function handleRemoveClubVenue(
  deps: ClubDeps,
  userId: string,
  formData: FormData,
): Promise<ClubVenueState> {
  const target = readVenueTarget(formData);
  if (target === null) {
    return { status: "not_found" };
  }
  const removed = await deps.transaction((db) => detachClubVenue(db, { userId, ...target }));
  return removed ? { status: "removed" } : { status: "not_found" };
}

/** Fait d'une autre salle la salle principale du club ; l'ancienne reste une de ses salles. */
export async function handleSetMainClubVenue(
  deps: ClubDeps,
  userId: string,
  formData: FormData,
): Promise<ClubVenueState> {
  const target = readVenueTarget(formData);
  if (target === null) {
    return { status: "not_found" };
  }
  return deps.transaction(async (db): Promise<ClubVenueState> => {
    const club = await lockClubVenues(db, { userId, clubId: target.clubId });
    if (club === null) {
      return { status: "not_found" };
    }
    const set = await setMainClubVenue(db, {
      userId,
      ...target,
      oldMainAddressId: club.mainAddressId,
    });
    return set ? { status: "main_set" } : { status: "not_found" };
  });
}
