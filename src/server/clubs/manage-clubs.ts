/**
 * Formulaires de l'onglet « Clubs » (§15.4.1) : ajout, modification (nom et adresse),
 * suppression. Ni Next.js ni authentification ici (§6.2) : le propriétaire vient de la
 * session, jamais du formulaire, et chaque requête filtre sur lui.
 *
 * Champs HTML : `name`, `street`, `number`, `postalCode`, `city`, `country` ; `clubId`
 * (caché) pour modifier ou supprimer.
 */
import { z } from "zod";
import { readText } from "@/lib/form-data";
import { CLUB_FIELDS, clubFormSchema } from "@/lib/schemas/clubs";
import type { ClubField } from "@/lib/schemas/clubs";
import { deleteClub, insertClubWithAddress, updateClubWithAddress } from "../db/clubs";
import type { DeleteClubResult } from "../db/clubs";
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
    street: readText(formData, "street") ?? "",
    number: readText(formData, "number") ?? "",
    postalCode: readText(formData, "postalCode"),
    city: readText(formData, "city") ?? "",
    country: readText(formData, "country") ?? "",
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
