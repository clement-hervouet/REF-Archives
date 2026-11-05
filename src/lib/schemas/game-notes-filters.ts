/**
 * Filtres de la page « Notes de match » (bloc 9), lus dans l'URL (`?categorie=…&niveau=…
 * &type=…&club=…&page=…`). Un paramètre invalide ou répété est ignoré plutôt que refusé : c'est un
 * filtre d'affichage, une URL bricolée ne doit pas casser la page (§6.3 : rien n'arrive
 * en base sans validation).
 */
import { z } from "zod";

export const GAME_NOTE_CATEGORIES = ["Departemental", "Regional", "National", "Pro"] as const;
export const GAME_NOTE_TYPES = ["Masculin", "Feminin"] as const;
export const GAME_NOTE_LEVELS = ["U13", "U15", "U18", "U21", "1", "2", "3"] as const;

/** Borne haute de pagination : au-delà, une URL bricolée ferait des OFFSET inutiles. */
export const MAX_GAME_NOTES_PAGE = 1000;

export type GameNoteCategory = (typeof GAME_NOTE_CATEGORIES)[number];
export type GameNoteType = (typeof GAME_NOTE_TYPES)[number];
export type GameNoteLevel = (typeof GAME_NOTE_LEVELS)[number];

export type GameNotesFilters = {
  /** Catégorie de la division : Départemental, Régional, National, Pro. */
  category: GameNoteCategory | null;
  /** Niveau de la division : U13 à U21, ou 1 à 3 (seniors). */
  level: GameNoteLevel | null;
  type: GameNoteType | null;
  clubId: string | null;
  /** Page demandée, à partir de 1. */
  page: number;
};

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

const categorySchema = z.enum(GAME_NOTE_CATEGORIES);
const typeSchema = z.enum(GAME_NOTE_TYPES);
const levelSchema = z.enum(GAME_NOTE_LEVELS);
const pageSchema = z
  .string()
  .regex(/^[1-9]\d{0,3}$/)
  .transform(Number)
  .pipe(z.number().max(MAX_GAME_NOTES_PAGE));

/** Valeur unique d'un paramètre ; absent ou répété → `undefined`. */
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseOrNull<T>(schema: z.ZodType<T>, value: string | undefined): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseGameNotesFilters(params: SearchParams): GameNotesFilters {
  return {
    category: parseOrNull(categorySchema, single(params.categorie)),
    level: parseOrNull(levelSchema, single(params.niveau)),
    type: parseOrNull(typeSchema, single(params.type)),
    clubId: parseOrNull(z.uuid(), single(params.club)),
    page: parseOrNull(pageSchema, single(params.page)) ?? 1,
  };
}

/** Paramètres d'URL des filtres (page 1 omise), pour les liens de pagination. */
export function gameNotesSearch(filters: GameNotesFilters): string {
  const params = new URLSearchParams();
  if (filters.category !== null) {
    params.set("categorie", filters.category);
  }
  if (filters.level !== null) {
    params.set("niveau", filters.level);
  }
  if (filters.type !== null) {
    params.set("type", filters.type);
  }
  if (filters.clubId !== null) {
    params.set("club", filters.clubId);
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const search = params.toString();
  return search === "" ? "" : `?${search}`;
}
