/**
 * Note de match (bloc 9, §5.3, §6.3) : niveau de confiance, niveau de stress, texte libre et
 * liens vers des clips. Tous les champs sont facultatifs, mais une note vide est refusée.
 *
 * Les clips sont des liens externes uniquement (§1.3) : `http(s)` seulement (jamais
 * `javascript:` ni `data:`), sans identifiants dans l'URL, et jamais résolus côté serveur
 * (§6.4 A10). La validation est purement syntaxique (`URL`), sans aucune requête réseau.
 */
import { z } from "zod";
import { CLIP_URL_MAX, MAX_CLIPS_PER_NOTE, NOTE_BODY_MAX } from "@/lib/game-form-fields";

// Constante sans Zod, aussi utilisée côté client : définie dans `game-form-fields.ts`.
export { MAX_CLIPS_PER_NOTE };

const CONTROL_CHAR = /\p{Cc}/u;

/** Vrai si le texte contient un caractère de contrôle autre que saut de ligne et tabulation. */
function hasForbiddenControlChar(value: string): boolean {
  for (const char of value) {
    if (char !== "\n" && char !== "\t" && CONTROL_CHAR.test(char)) {
      return true;
    }
  }
  return false;
}

/**
 * Normalise un lien de clip, ou `null` s'il est refusé. Fonction pure, sans réseau : `URL`
 * ne fait qu'analyser la chaîne. Le résultat (`href`) met le schéma et l'hôte en minuscules
 * et encode les espaces, ce qui satisfait le CHECK de la base.
 */
export function normalizeClipUrl(raw: string): string | null {
  const value = raw.trim();
  if (value === "" || value.length > CLIP_URL_MAX || !URL.canParse(value)) {
    return null;
  }
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  // « https://youtube.com@piege.example » : l'hôte réel est après le @, on refuse.
  if (url.username !== "" || url.password !== "" || url.hostname === "") {
    return null;
  }
  return url.href.length <= CLIP_URL_MAX ? url.href : null;
}

/** Niveau saisi dans une liste : « » (non renseigné) ou « 1 » à « 5 ». */
export const noteLevelSchema = z
  .string()
  .trim()
  .regex(/^[1-5]?$/)
  .transform((value) => (value === "" ? null : Number(value)));

/** Texte libre, multiligne. Une saisie vide (ou faite d'espaces) devient `null`. */
export const noteBodySchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .pipe(
    z
      .string()
      .max(NOTE_BODY_MAX)
      .refine((value) => !hasForbiddenControlChar(value)),
  )
  .transform((value) => (value === "" ? null : value));

/**
 * Liens de clips : les lignes vides sont ignorées, les doublons retirés (le premier garde
 * sa place), l'ordre de saisie conservé. Chaque lien invalide est signalé à son index.
 */
export const noteClipsSchema = z
  .array(z.string().max(CLIP_URL_MAX * 2))
  .max(MAX_CLIPS_PER_NOTE * 2)
  .transform((values, ctx) => {
    const clips: string[] = [];
    values.forEach((raw, index) => {
      if (raw.trim() === "") {
        return;
      }
      const url = normalizeClipUrl(raw);
      if (url === null) {
        ctx.addIssue({ code: "custom", path: [index], message: "clip_invalid" });
      } else if (!clips.includes(url)) {
        clips.push(url);
      }
    });
    if (clips.length > MAX_CLIPS_PER_NOTE) {
      ctx.addIssue({ code: "custom", path: [], message: "too_many_clips" });
    }
    return clips;
  });

const noteFieldsSchema = z.object({
  confidence: noteLevelSchema,
  stress: noteLevelSchema,
  management: noteLevelSchema,
  judgment: noteLevelSchema,
  body: noteBodySchema,
  clips: noteClipsSchema,
});

/** Formulaire complet de note : au moins un champ renseigné. */
export const noteFormSchema = noteFieldsSchema.superRefine((value, ctx) => {
  if (
    value.confidence === null &&
    value.stress === null &&
    value.management === null &&
    value.judgment === null &&
    value.body === null &&
    value.clips.length === 0
  ) {
    ctx.addIssue({ code: "custom", path: ["body"], message: "empty_note" });
  }
});

export type NoteFormInput = z.input<typeof noteFormSchema>;
export type NoteForm = z.output<typeof noteFormSchema>;
