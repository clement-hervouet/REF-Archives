/**
 * Formulaire de note d'un match (bloc 9) : lecture du FormData, validation Zod, puis
 * service ; suppression. Ni Next.js ni authentification ici (§6.2).
 *
 * Champs HTML : `gameId` (caché), les échelles `confidence`, `stress`, `management` et
 * `judgment` (boutons radio, vide = non renseigné), `body`, `clips` (zone de texte, un lien
 * par ligne).
 */
import { z } from "zod";
import { NOTE_LEVEL_FIELDS } from "@/lib/game-form-fields";
import type { NoteLevelField } from "@/lib/game-form-fields";
import { noteFormSchema } from "@/lib/schemas/notes";
import { softDeleteNote } from "../db/notes";
import { saveGameNote } from "./manage-note";
import type { GameDeps } from "./rejection";

export type NoteField = NoteLevelField | "body";

export type NoteFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      fields: readonly NoteField[];
      /** Numéros (à partir de 1) des lignes de liens refusées. */
      clipLines: readonly number[];
      tooManyClips: boolean;
      empty: boolean;
    }
  | { status: "saved" }
  | { status: "not_found"; field: "game" };

export type DeleteNoteState = { status: "idle" } | { status: "deleted" } | { status: "not_found" };

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Reconstruit l'objet attendu par `noteFormSchema` ; rien n'est validé ici. */
export function readNoteFormData(formData: FormData): Record<string, unknown> {
  const clips = text(formData, "clips");
  return {
    // Bouton radio : rien de coché = non renseigné.
    ...Object.fromEntries(NOTE_LEVEL_FIELDS.map((field) => [field, text(formData, field) ?? ""])),
    body: text(formData, "body") ?? "",
    clips: clips === undefined ? [] : clips.split(/\r\n|\r|\n/),
  };
}

const NOTE_FIELDS: readonly NoteField[] = [...NOTE_LEVEL_FIELDS, "body"];

function isNoteField(value: string): value is NoteField {
  return NOTE_FIELDS.some((field) => field === value);
}

function invalidState(error: z.ZodError): NoteFormState {
  const fields = new Set<NoteField>();
  const clipLines: number[] = [];
  let tooManyClips = false;
  let empty = false;
  for (const issue of error.issues) {
    const [top, index] = issue.path;
    if (top === "clips") {
      if (typeof index === "number") {
        clipLines.push(index + 1);
      } else {
        // Tableau trop long (avant ou après nettoyage) : même message.
        tooManyClips = true;
      }
    } else if (issue.message === "empty_note") {
      empty = true;
    } else if (typeof top === "string" && isNoteField(top)) {
      fields.add(top);
    }
  }
  return {
    status: "invalid",
    fields: NOTE_FIELDS.filter((field) => fields.has(field)),
    clipLines,
    tooManyClips,
    empty,
  };
}

const idSchema = z.uuid();

/** Valide puis enregistre la note du match désigné par le champ caché `gameId`. */
export async function handleSaveNote(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<NoteFormState> {
  const gameId = idSchema.safeParse(text(formData, "gameId"));
  if (!gameId.success) {
    return { status: "not_found", field: "game" };
  }
  const parsed = noteFormSchema.safeParse(readNoteFormData(formData));
  if (!parsed.success) {
    return invalidState(parsed.error);
  }
  const result = await saveGameNote(deps, userId, gameId.data, parsed.data);
  return result.status === "saved" ? result : { status: "not_found", field: "game" };
}

/** Supprime (soft delete) la note du match désigné par le champ caché `gameId`. */
export async function handleDeleteNote(
  deps: GameDeps,
  userId: string,
  formData: FormData,
): Promise<DeleteNoteState> {
  const gameId = idSchema.safeParse(text(formData, "gameId"));
  if (!gameId.success) {
    return { status: "not_found" };
  }
  const deleted = await deps.transaction((db) =>
    softDeleteNote(db, { userId, gameId: gameId.data }),
  );
  return deleted ? { status: "deleted" } : { status: "not_found" };
}

/** Valeurs de départ du formulaire depuis la note enregistrée. */
export function noteFormValues(
  note: (Record<NoteLevelField, number | null> & { body: string | null; clips: string[] }) | null,
): Record<string, string> {
  const levels = Object.fromEntries(
    NOTE_LEVEL_FIELDS.map((field) => {
      const value = note?.[field] ?? null;
      return [field, value === null ? "" : String(value)];
    }),
  );
  if (note === null) {
    return { ...levels, body: "", clips: "" };
  }
  return {
    ...levels,
    body: note.body ?? "",
    clips: note.clips.join("\n"),
  };
}
