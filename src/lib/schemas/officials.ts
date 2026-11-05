/**
 * Officiels d'un match complet (bloc 9, §6.3) : arbitres 1 à 3 dans l'ordre officiel et
 * observateur. Chaque place est vide, occupée par l'utilisateur (« Moi »), par un collègue
 * déjà connu, ou par un nouveau collègue créé à la volée (fiche nom seul, §3.8).
 *
 * Règles (aussi garanties par des CHECK en base, migration 013) :
 * - l'arbitre 1 est obligatoire, et pas d'arbitre 3 sans arbitre 2 ;
 * - l'utilisateur occupe exactement une place, n'importe laquelle (c'est son archive) ;
 * - une même personne n'occupe jamais deux places.
 * La case « a un compte » est informative : elle ne crée aucun lien entre comptes (§6.5).
 */
import { z } from "zod";

/** Places dans l'ordre officiel, qui est aussi l'ordre d'affichage. */
export const OFFICIAL_SLOTS = ["referee1", "referee2", "referee3", "observer"] as const;
export type OfficialSlot = (typeof OFFICIAL_SLOTS)[number];

/** Longueur maximale d'un prénom ou d'un nom de collègue. */
export const PERSON_NAME_MAX = 100;

/** Aucun caractère de contrôle (sauts de ligne, tabulations, NUL…). */
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;

const requiredName = z.string().trim().min(1).max(PERSON_NAME_MAX).regex(NO_CONTROL_CHARS);

/** Prénom facultatif : une saisie vide devient `null` (colonne NULL). */
const optionalName = z
  .string()
  .trim()
  .max(PERSON_NAME_MAX)
  .regex(NO_CONTROL_CHARS)
  .transform((value) => (value === "" ? null : value));

/** Nouveau collègue : nom obligatoire, prénom facultatif, case « a un compte ». */
export const newColleagueSchema = z.object({
  firstname: optionalName,
  lastname: requiredName,
  hasAccount: z.boolean(),
});

export const officialChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("self") }),
  z.object({ kind: z.literal("existing"), personId: z.uuid() }),
  z.object({ kind: z.literal("new"), colleague: newColleagueSchema }),
]);

export type OfficialChoice = z.output<typeof officialChoiceSchema>;
export type Officials = Record<OfficialSlot, OfficialChoice>;

/** Codes d'erreur, traduits par l'interface (`src/i18n/fr.ts`). */
export type OfficialsIssueCode =
  | "referee1_required"
  | "referee3_without_referee2"
  | "self_missing"
  | "self_twice"
  | "person_twice";

export type OfficialsIssue = { slot: OfficialSlot; code: OfficialsIssueCode };

/**
 * Vérifie la composition des officiels. Fonction pure : la même règle sert au schéma et
 * aux tests. Un doublon est signalé sur la seconde place qui le contient.
 */
export function findOfficialsIssues(officials: Officials): OfficialsIssue[] {
  const issues: OfficialsIssue[] = [];
  if (officials.referee1.kind === "none") {
    issues.push({ slot: "referee1", code: "referee1_required" });
  }
  if (officials.referee3.kind !== "none" && officials.referee2.kind === "none") {
    issues.push({ slot: "referee3", code: "referee3_without_referee2" });
  }

  let selfSeen = false;
  const personIds = new Set<string>();
  for (const slot of OFFICIAL_SLOTS) {
    const choice = officials[slot];
    if (choice.kind === "self") {
      if (selfSeen) {
        issues.push({ slot, code: "self_twice" });
      }
      selfSeen = true;
    } else if (choice.kind === "existing") {
      if (personIds.has(choice.personId)) {
        issues.push({ slot, code: "person_twice" });
      }
      personIds.add(choice.personId);
    }
  }
  if (!selfSeen) {
    issues.push({ slot: "referee1", code: "self_missing" });
  }
  return issues;
}

/** Les quatre places, validées ensemble (toutes les erreurs remontent en un seul envoi). */
export const officialsSchema = z
  .object({
    referee1: officialChoiceSchema,
    referee2: officialChoiceSchema,
    referee3: officialChoiceSchema,
    observer: officialChoiceSchema,
  })
  .superRefine((value, ctx) => {
    for (const issue of findOfficialsIssues(value)) {
      ctx.addIssue({ code: "custom", path: [issue.slot], message: issue.code });
    }
  });

export type OfficialsInput = z.input<typeof officialsSchema>;
