/**
 * Formulaires de la page « Mes collègues » (blocs 9 et 10) : ajout, modification,
 * suppression. Ni Next.js ni authentification ici (§6.2) : le propriétaire vient de la
 * session, jamais du formulaire, et chaque requête filtre sur lui.
 *
 * Champs HTML : `firstname`, `lastname`, `hasAccount` (case), `clubId` (vide = aucun club,
 * identifiant d'un club de l'utilisateur, ou `new` avec `clubName`, `clubStreet`,
 * `clubNumber`, `clubPostalCode`, `clubCity`, `clubCountry` pour le créer) ; `personId`
 * (caché) pour modifier ou supprimer. Un nouveau club et le collègue sont écrits dans la
 * même transaction : un refus (limite atteinte) n'en laisse rien, adresse comprise.
 */
import { z } from "zod";
import { NEW_CHOICE } from "@/lib/compensation-form-fields";
import { readText } from "@/lib/form-data";
import { teamChoiceSchema } from "@/lib/schemas/compensations";
import { newColleagueSchema } from "@/lib/schemas/officials";
import { isOwnedClub } from "../db/clubs";
import { insertAddress, insertClub } from "../db/compensations";
import type { NewAddress } from "../db/compensations";
import { deleteColleague, insertColleague, updateColleague } from "../db/persons";
import type { Queryable } from "../db/users";
import { rejectGame, runRejectable } from "./rejection";
import type { GameDeps, GameRejection } from "./rejection";

/** Champ du nouveau club en erreur. */
export type NewClubField = "name" | "street" | "number" | "postalCode" | "city" | "country";

export type ColleagueFormState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "created" }
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "limit_reached" }
  | { status: "club_not_found" }
  | { status: "club_invalid"; fields: readonly NewClubField[] }
  | { status: "club_limit" };

export type DeleteColleagueState =
  { status: "idle" } | { status: "deleted" } | { status: "in_use" } | { status: "not_found" };

function parseColleague(formData: FormData) {
  return newColleagueSchema.safeParse({
    firstname: readText(formData, "firstname") ?? "",
    lastname: readText(formData, "lastname"),
    hasAccount: readText(formData, "hasAccount") === "on",
  });
}

const idSchema = z.uuid();

type ClubChoice =
  | { kind: "none" }
  | { kind: "existing"; clubId: string }
  | { kind: "new"; name: string; address: NewAddress };

type ClubRead = { ok: true; choice: ClubChoice } | { ok: false; state: ColleagueFormState };

const NEW_CLUB_FIELDS: readonly NewClubField[] = [
  "name",
  "street",
  "number",
  "postalCode",
  "city",
  "country",
];

function isNewClubField(value: unknown): value is NewClubField {
  return NEW_CLUB_FIELDS.some((field) => field === value);
}

/** Champs du nouveau club refusés, dans l'ordre du formulaire. */
function newClubErrors(error: z.ZodError): NewClubField[] {
  const fields = new Set<NewClubField>();
  for (const issue of error.issues) {
    const [top, part] = issue.path;
    const field = top === "address" ? part : top;
    if (isNewClubField(field)) {
      fields.add(field);
    }
  }
  return NEW_CLUB_FIELDS.filter((field) => fields.has(field));
}

/** Club choisi : aucun, un club existant (identifiant valide) ou un nouveau club validé. */
function readClubChoice(formData: FormData): ClubRead {
  const raw = readText(formData, "clubId") ?? "";
  if (raw === "") {
    return { ok: true, choice: { kind: "none" } };
  }
  if (raw === NEW_CHOICE) {
    // Mêmes règles que le nouveau club d'une indemnité (bloc 6).
    const parsed = teamChoiceSchema.safeParse({
      kind: "new",
      name: readText(formData, "clubName"),
      address: {
        street: readText(formData, "clubStreet"),
        number: readText(formData, "clubNumber") ?? "",
        postalCode: readText(formData, "clubPostalCode"),
        city: readText(formData, "clubCity"),
        country: readText(formData, "clubCountry") ?? "",
      },
    });
    if (!parsed.success) {
      return { ok: false, state: { status: "club_invalid", fields: newClubErrors(parsed.error) } };
    }
    if (parsed.data.kind !== "new") {
      return { ok: false, state: { status: "club_invalid", fields: [] } };
    }
    return {
      ok: true,
      choice: { kind: "new", name: parsed.data.name, address: parsed.data.address },
    };
  }
  const clubId = idSchema.safeParse(raw);
  return clubId.success
    ? { ok: true, choice: { kind: "existing", clubId: clubId.data } }
    : { ok: false, state: { status: "club_not_found" } };
}

/**
 * Identifiant du club à enregistrer : `null` (aucun), le club existant s'il est à
 * l'utilisateur (sinon `undefined`), ou le club créé avec son adresse.
 */
async function resolveClubId(
  db: Queryable,
  userId: string,
  choice: ClubChoice,
): Promise<string | null | undefined> {
  switch (choice.kind) {
    case "none":
      return null;
    case "existing":
      return (await isOwnedClub(db, { userId, clubId: choice.clubId })) ? choice.clubId : undefined;
    case "new": {
      const addressId = await insertAddress(db, { userId, address: choice.address });
      const clubId = await insertClub(db, { userId, name: choice.name, addressId });
      return clubId ?? rejectGame({ status: "limit_reached", resource: "club" });
    }
  }
}

/** Traduit un refus levé dans la transaction (limite de clubs ou de collègues, introuvable). */
function settle(result: ColleagueFormState | GameRejection): ColleagueFormState {
  if ("resource" in result) {
    return result.resource === "club" ? { status: "club_limit" } : { status: "limit_reached" };
  }
  if ("field" in result || "gameId" in result || result.status === "no_rate_at_date") {
    return { status: "not_found" };
  }
  return result;
}

type ParsedColleague = z.infer<typeof newColleagueSchema>;

/**
 * Lecture et validation communes (collègue puis club), suivies de `write` dans une
 * transaction qui résout le club à l'utilisateur. Un refus (club introuvable, limite de
 * clubs ou de collègues) est traduit par `settle`.
 */
async function writeColleague(
  deps: GameDeps,
  userId: string,
  formData: FormData,
  write: (
    db: Queryable,
    colleague: ParsedColleague,
    clubId: string | null,
  ) => Promise<ColleagueFormState>,
): Promise<ColleagueFormState> {
  const parsed = parseColleague(formData);
  if (!parsed.success) {
    return { status: "invalid" };
  }
  const club = readClubChoice(formData);
  if (!club.ok) {
    return club.state;
  }
  const result = await runRejectable(deps, async (db): Promise<ColleagueFormState> => {
    const clubId = await resolveClubId(db, userId, club.choice);
    if (clubId === undefined) {
      return { status: "club_not_found" };
    }
    return write(db, parsed.data, clubId);
  });
  return settle(result);
}

export async function handleCreateColleague(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<ColleagueFormState> {
  return writeColleague(deps, userId, formData, async (db, colleague, clubId) => {
    const personId = await insertColleague(db, { userId, colleague, clubId });
    if (personId === null) {
      // Limite de collègues : annule aussi le club créé juste avant.
      rejectGame({ status: "limit_reached", resource: "colleague" });
    }
    return { status: "created" };
  });
}

export async function handleUpdateColleague(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<ColleagueFormState> {
  const personId = idSchema.safeParse(readText(formData, "personId"));
  if (!personId.success) {
    return { status: "not_found" };
  }
  return writeColleague(deps, userId, formData, async (db, colleague, clubId) => {
    const updated = await updateColleague(db, {
      userId,
      personId: personId.data,
      colleague,
      clubId,
    });
    if (!updated) {
      // Collègue introuvable : annule aussi le club créé juste avant.
      rejectGame({ status: "not_found", field: "game" });
    }
    return { status: "updated" };
  });
}

export async function handleDeleteColleague(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteColleagueState> {
  const personId = idSchema.safeParse(readText(formData, "personId"));
  if (!personId.success) {
    return { status: "not_found" };
  }
  const result = await deps.transaction((db) =>
    deleteColleague(db, { userId, personId: personId.data }),
  );
  return { status: result };
}
