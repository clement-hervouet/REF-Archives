/**
 * Formulaires de la page « Mes collègues » (bloc 9) : ajout, modification, suppression.
 * Ni Next.js ni authentification ici (§6.2) : le propriétaire vient de la session,
 * jamais du formulaire, et chaque requête filtre sur lui.
 *
 * Champs HTML : `firstname`, `lastname`, `hasAccount` (case) ; `personId` (caché) pour
 * modifier ou supprimer.
 */
import { z } from "zod";
import { newColleagueSchema } from "@/lib/schemas/officials";
import { deleteColleague, insertColleague, updateColleague } from "../db/persons";
import type { GameDeps } from "./rejection";

export type ColleagueFormState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "created" }
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "limit_reached" };

export type DeleteColleagueState =
  { status: "idle" } | { status: "deleted" } | { status: "in_use" } | { status: "not_found" };

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function parseColleague(formData: FormData) {
  return newColleagueSchema.safeParse({
    firstname: text(formData, "firstname") ?? "",
    lastname: text(formData, "lastname"),
    hasAccount: text(formData, "hasAccount") === "on",
  });
}

const idSchema = z.uuid();

export async function handleCreateColleague(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<ColleagueFormState> {
  const parsed = parseColleague(formData);
  if (!parsed.success) {
    return { status: "invalid" };
  }
  const personId = await deps.transaction((db) =>
    insertColleague(db, { userId, colleague: parsed.data }),
  );
  return personId === null ? { status: "limit_reached" } : { status: "created" };
}

export async function handleUpdateColleague(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<ColleagueFormState> {
  const personId = idSchema.safeParse(text(formData, "personId"));
  if (!personId.success) {
    return { status: "not_found" };
  }
  const parsed = parseColleague(formData);
  if (!parsed.success) {
    return { status: "invalid" };
  }
  const updated = await deps.transaction((db) =>
    updateColleague(db, { userId, personId: personId.data, colleague: parsed.data }),
  );
  return updated ? { status: "updated" } : { status: "not_found" };
}

export async function handleDeleteColleague(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteColleagueState> {
  const personId = idSchema.safeParse(text(formData, "personId"));
  if (!personId.success) {
    return { status: "not_found" };
  }
  const result = await deps.transaction((db) =>
    deleteColleague(db, { userId, personId: personId.data }),
  );
  return { status: result };
}
