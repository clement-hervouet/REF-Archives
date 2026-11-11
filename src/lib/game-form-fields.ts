/**
 * Constantes des matchs complets (bloc 9), partagées par le client (composants) et le
 * serveur (schémas, lecture du FormData). Sans dépendance : ni Zod ni code serveur
 * n'est embarqué dans le bundle client.
 */

/** Places dans l'ordre officiel, qui est aussi l'ordre d'affichage. */
export const OFFICIAL_SLOTS = ["referee1", "referee2", "referee3", "observer"] as const;
export type OfficialSlot = (typeof OFFICIAL_SLOTS)[number];

/** Longueur maximale d'un prénom ou d'un nom de collègue. */
export const PERSON_NAME_MAX = 100;

/** Valeurs spéciales de la liste d'une place ; sinon, l'identifiant d'un collègue. */
export const PERSON_NONE = "none";
export const PERSON_SELF = "self";
export const PERSON_NEW = "new";

/** Noms des champs HTML d'une place : `referee1Person`, `referee1Lastname`… */
export function officialFieldName(
  slot: OfficialSlot,
  part: "Person" | "Firstname" | "Lastname" | "HasAccount",
): string {
  return `${slot}${part}`;
}

/** Échelle des niveaux de la note (§12, tranché au bloc 9). */
export const NOTE_LEVELS = [1, 2, 3, 4, 5] as const;

/**
 * Échelles de la note, dans l'ordre d'affichage : confiance et stress (bloc 9), gestion du
 * match et jugement (bloc 10, migration 017). Noms des champs HTML et des colonnes.
 */
export const NOTE_LEVEL_FIELDS = ["confidence", "stress", "management", "judgment"] as const;
export type NoteLevelField = (typeof NOTE_LEVEL_FIELDS)[number];

/** Bornes alignées sur la migration 013 (`note.body`, `note_clip`). */
export const NOTE_BODY_MAX = 4096;
export const MAX_CLIPS_PER_NOTE = 10;
export const CLIP_URL_MAX = 2048;
