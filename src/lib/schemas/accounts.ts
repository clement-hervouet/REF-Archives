/**
 * Formulaires de la page admin « Comptes » (bloc 10) : modification d'un compte et
 * blocage. Les messages sont des codes, traduits à l'affichage.
 */
import { z } from "zod";
import { isIsoDate, toParisIsoDate } from "@/lib/dates";
import { parisLocalToUtc } from "@/lib/paris-time";
import { emailSchema } from "./auth";
import { parseProfile } from "./profile";
import type { Profile, ProfileIssue } from "./profile";

export const ACCOUNT_ROLES = ["user", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** Délai avant l'effacement définitif d'un compte dont la suppression est demandée. */
export const ACCOUNT_DELETION_DELAY_DAYS = 30;

export type AccountEdit = Profile & { email: string; role: AccountRole };
export type AccountEditIssue = ProfileIssue | "email.invalid" | "role.invalid";

export type AccountEditResult =
  { success: true; edit: AccountEdit } | { success: false; issues: AccountEditIssue[] };

const roleSchema = z.enum(ACCOUNT_ROLES);

/** Valide nom, prénom (mêmes règles que Paramètres), email et rôle. */
export function parseAccountEdit(input: {
  firstname: unknown;
  lastname: unknown;
  email: unknown;
  role: unknown;
}): AccountEditResult {
  const profile = parseProfile(input);
  const email = emailSchema.safeParse(input.email);
  const role = roleSchema.safeParse(input.role);
  const issues: AccountEditIssue[] = profile.success ? [] : [...profile.issues];
  if (!email.success) issues.push("email.invalid");
  if (!role.success) issues.push("role.invalid");
  if (!profile.success || !email.success || !role.success) {
    return { success: false, issues };
  }
  return { success: true, edit: { ...profile.profile, email: email.data, role: role.data } };
}

// ─── Blocage ────────────────────────────────────────────────────────────────

export const BLOCK_DURATIONS = ["24h", "7d", "30d"] as const;
export type BlockDuration = (typeof BLOCK_DURATIONS)[number];
export const BLOCK_MODES = [...BLOCK_DURATIONS, "date", "indefinite"] as const;
export type BlockMode = (typeof BLOCK_MODES)[number];

const DURATION_MS: Record<BlockDuration, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** Une date de fin au-delà serait une erreur de saisie : « sans fin » existe pour ça. */
export const MAX_BLOCK_DAYS = 5 * 366;

export type BlockIssue = "mode.invalid" | "date.invalid" | "date.past" | "date.too_far";

export type BlockResult =
  /** `until: null` = jusqu'à déblocage ; sinon l'instant (exclu) où le blocage cesse. */
  { success: true; until: Date | null } | { success: false; issue: BlockIssue };

/**
 * Fin du blocage choisie dans le formulaire. Une date (`AAAA-MM-JJ`) bloque jusqu'à ce
 * jour-là, minuit à Paris : le compte redevient actif le jour choisi.
 */
export function parseBlockChoice(input: { mode: unknown; date: unknown }, now: Date): BlockResult {
  const mode = z.enum(BLOCK_MODES).safeParse(input.mode);
  if (!mode.success) {
    return { success: false, issue: "mode.invalid" };
  }
  switch (mode.data) {
    case "indefinite":
      return { success: true, until: null };
    case "date": {
      if (typeof input.date !== "string" || !isIsoDate(input.date)) {
        return { success: false, issue: "date.invalid" };
      }
      if (input.date <= toParisIsoDate(now)) {
        return { success: false, issue: "date.past" };
      }
      const until = parisLocalToUtc(input.date, "00:00");
      if (until.getTime() - now.getTime() > MAX_BLOCK_DAYS * 24 * 60 * 60 * 1000) {
        return { success: false, issue: "date.too_far" };
      }
      return { success: true, until };
    }
    default:
      return { success: true, until: new Date(now.getTime() + DURATION_MS[mode.data]) };
  }
}
