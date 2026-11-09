/**
 * Gestion des comptes par un administrateur (bloc 10). Ni Next.js ni authentification ici
 * (§6.2) : l'appelant a vérifié `requireAdmin` et passe l'identifiant de l'admin.
 *
 * Garde-fous, vérifiés sous verrou dans la transaction :
 *  - un admin ne se bloque pas, ne se supprime pas et ne retire pas ses propres droits ;
 *  - l'application garde toujours au moins un admin actif (bloquer, supprimer ou rétrograder
 *    le dernier est refusé) ;
 *  - bloquer ou programmer la suppression ferme toutes les sessions du compte.
 * Les effets hors base (emails, journal) sont laissés à l'appelant : il reçoit ce qu'il faut.
 */
import { z } from "zod";
import {
  ACCOUNT_DELETION_DELAY_DAYS,
  parseAccountEdit,
  parseBlockChoice,
} from "@/lib/schemas/accounts";
import type { AccountEditIssue, BlockIssue } from "@/lib/schemas/accounts";
import { accountSuspension } from "../db/account-state";
import {
  blockAccount,
  cancelAccountDeletion,
  lockAccount,
  lockOtherActiveAdmins,
  scheduleAccountDeletion,
  unblockAccount,
  updateAccount,
} from "../db/accounts";
import type { AccountSummary } from "../db/accounts";
import { createPasswordReset, deletePendingPasswordResets } from "../db/password-resets";
import { revokeAllUserSessions } from "../db/sessions";
import { EmailAlreadyUsedError } from "../db/users";
import type { Queryable } from "../db/users";
import type { GeneratedToken } from "../auth/tokens";

type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

export type AccountDeps = {
  transaction: Transaction;
  now: () => Date;
  generateToken: () => GeneratedToken;
};

/** Refus communs : compte introuvable, action sur soi-même, dernier admin actif. */
type Guarded = { status: "not_found" } | { status: "self" } | { status: "last_admin" };

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

const idSchema = z.uuid();

function readAccountId(formData: FormData): string | null {
  const parsed = idSchema.safeParse(text(formData, "accountId"));
  return parsed.success ? parsed.data : null;
}

/** Vrai si le compte compte parmi les admins actifs (ceux qui garantissent l'accès). */
function isActiveAdmin(account: AccountSummary, now: Date): boolean {
  return account.role === "admin" && accountSuspension(account.state, now) === null;
}

/** Refuse de couper le dernier admin actif. À appeler sous verrou, dans la transaction. */
async function wouldLeaveNoAdmin(db: Queryable, account: AccountSummary, now: Date) {
  return isActiveAdmin(account, now) && (await lockOtherActiveAdmins(db, account.id)) === 0;
}

// ─── Modifier ───────────────────────────────────────────────────────────────

export type UpdateAccountResult =
  | { status: "invalid"; issues: readonly AccountEditIssue[] }
  | { status: "email_taken" }
  | { status: "not_found" }
  | { status: "self_demotion" }
  | { status: "last_admin" }
  | {
      status: "updated";
      accountId: string;
      /** Ancienne adresse si l'email a changé (elle reçoit une alerte), sinon `null`. */
      previousEmail: string | null;
      email: string;
    };

export async function handleUpdateAccount(
  deps: AccountDeps,
  actorId: string,
  formData: FormData,
): Promise<UpdateAccountResult> {
  const accountId = readAccountId(formData);
  if (accountId === null) {
    return { status: "not_found" };
  }
  const parsed = parseAccountEdit({
    firstname: text(formData, "firstname"),
    lastname: text(formData, "lastname"),
    email: text(formData, "email"),
    role: text(formData, "role"),
  });
  if (!parsed.success) {
    return { status: "invalid", issues: parsed.issues };
  }
  const { edit } = parsed;
  try {
    return await deps.transaction(async (db): Promise<UpdateAccountResult> => {
      const account = await lockAccount(db, accountId);
      if (account === null) {
        return { status: "not_found" };
      }
      if (account.role === "admin" && edit.role !== "admin") {
        if (account.id === actorId) {
          return { status: "self_demotion" };
        }
        if (await wouldLeaveNoAdmin(db, account, deps.now())) {
          return { status: "last_admin" };
        }
      }
      await updateAccount(db, { accountId, ...edit });
      const emailChanged = account.email.toLowerCase() !== edit.email.toLowerCase();
      return {
        status: "updated",
        accountId,
        previousEmail: emailChanged ? account.email : null,
        email: edit.email,
      };
    });
  } catch (error: unknown) {
    if (error instanceof EmailAlreadyUsedError) {
      return { status: "email_taken" };
    }
    throw error;
  }
}

// ─── Bloquer / débloquer ────────────────────────────────────────────────────

export type BlockAccountResult =
  | Guarded
  | { status: "invalid"; issue: BlockIssue }
  | { status: "deletion_pending" }
  | { status: "blocked"; accountId: string; until: Date | null };

export async function handleBlockAccount(
  deps: AccountDeps,
  actorId: string,
  formData: FormData,
): Promise<BlockAccountResult> {
  const accountId = readAccountId(formData);
  if (accountId === null) {
    return { status: "not_found" };
  }
  const now = deps.now();
  const choice = parseBlockChoice(
    { mode: text(formData, "mode"), date: text(formData, "date") },
    now,
  );
  if (!choice.success) {
    return { status: "invalid", issue: choice.issue };
  }
  return deps.transaction(async (db): Promise<BlockAccountResult> => {
    const account = await lockAccount(db, accountId);
    if (account === null) {
      return { status: "not_found" };
    }
    if (account.id === actorId) {
      return { status: "self" };
    }
    if (account.state.deletionDueAt !== null) {
      return { status: "deletion_pending" };
    }
    if (await wouldLeaveNoAdmin(db, account, now)) {
      return { status: "last_admin" };
    }
    await blockAccount(db, { accountId, until: choice.until });
    // Le blocage vaut déconnexion immédiate, partout.
    await revokeAllUserSessions(db, accountId, null);
    return { status: "blocked", accountId, until: choice.until };
  });
}

export type UnblockAccountResult =
  { status: "not_found" } | { status: "unblocked"; accountId: string };

export async function handleUnblockAccount(
  deps: AccountDeps,
  formData: FormData,
): Promise<UnblockAccountResult> {
  const accountId = readAccountId(formData);
  if (accountId === null) {
    return { status: "not_found" };
  }
  const done = await deps.transaction((db) => unblockAccount(db, accountId));
  return done ? { status: "unblocked", accountId } : { status: "not_found" };
}

// ─── Suppression différée ───────────────────────────────────────────────────

export type ScheduleDeletionResult =
  | Guarded
  | { status: "confirmation_mismatch" }
  | { status: "scheduled"; accountId: string; dueAt: Date };

/**
 * Programme l'effacement définitif dans `ACCOUNT_DELETION_DELAY_DAYS` jours. L'admin
 * confirme en retapant l'email du compte (champ `confirmEmail`).
 */
export async function handleScheduleDeletion(
  deps: AccountDeps,
  actorId: string,
  formData: FormData,
): Promise<ScheduleDeletionResult> {
  const accountId = readAccountId(formData);
  if (accountId === null) {
    return { status: "not_found" };
  }
  const typed = (text(formData, "confirmEmail") ?? "").trim().toLowerCase();
  return deps.transaction(async (db): Promise<ScheduleDeletionResult> => {
    const account = await lockAccount(db, accountId);
    if (account === null) {
      return { status: "not_found" };
    }
    if (account.id === actorId) {
      return { status: "self" };
    }
    if (typed !== account.email.toLowerCase()) {
      return { status: "confirmation_mismatch" };
    }
    if (account.state.deletionDueAt !== null) {
      // Déjà programmée (double clic, deux onglets) : la date ne recule pas.
      return { status: "scheduled", accountId, dueAt: account.state.deletionDueAt };
    }
    if (await wouldLeaveNoAdmin(db, account, deps.now())) {
      return { status: "last_admin" };
    }
    const dueAt = await scheduleAccountDeletion(db, {
      accountId,
      days: ACCOUNT_DELETION_DELAY_DAYS,
    });
    if (dueAt === null) {
      return { status: "not_found" };
    }
    await revokeAllUserSessions(db, accountId, null);
    return { status: "scheduled", accountId, dueAt };
  });
}

export type CancelDeletionResult =
  { status: "not_found" } | { status: "cancelled"; accountId: string };

export async function handleCancelDeletion(
  deps: AccountDeps,
  formData: FormData,
): Promise<CancelDeletionResult> {
  const accountId = readAccountId(formData);
  if (accountId === null) {
    return { status: "not_found" };
  }
  const done = await deps.transaction((db) => cancelAccountDeletion(db, accountId));
  return done ? { status: "cancelled", accountId } : { status: "not_found" };
}

// ─── Lien de mot de passe ───────────────────────────────────────────────────

export type PasswordResetLinkResult =
  | { status: "not_found" }
  | { status: "deletion_pending" }
  | {
      status: "issued";
      accountId: string;
      email: string;
      /** À envoyer par email ; jamais affiché à l'admin, stocké ni journalisé. */
      token: string;
    };

/**
 * Crée un lien de réinitialisation pour le compte (mêmes règles que « Mot de passe
 * oublié ? » : un seul lien actif, 30 minutes). L'admin ne voit jamais le lien.
 */
export async function handleIssuePasswordReset(
  deps: AccountDeps,
  formData: FormData,
): Promise<PasswordResetLinkResult> {
  const accountId = readAccountId(formData);
  if (accountId === null) {
    return { status: "not_found" };
  }
  return deps.transaction(async (db): Promise<PasswordResetLinkResult> => {
    const account = await lockAccount(db, accountId);
    if (account === null) {
      return { status: "not_found" };
    }
    if (account.state.deletionDueAt !== null) {
      return { status: "deletion_pending" };
    }
    await deletePendingPasswordResets(db, accountId);
    const { token, hash } = deps.generateToken();
    await createPasswordReset(db, { userId: accountId, tokenHash: hash });
    return { status: "issued", accountId, email: account.email, token };
  });
}
