"use server";

/**
 * Server Actions de la page admin « Comptes » (bloc 10). Chacune vérifie la session admin
 * en base (§6.2) ; l'admin vient toujours de la session, jamais du formulaire. Les règles
 * (soi-même, dernier admin) sont dans `src/server/admin/manage-accounts.ts`.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import type { AccountEditIssue, BlockIssue } from "@/lib/schemas/accounts";
import { ACCOUNTS_PATH, accountPath } from "@/lib/app-paths";
import {
  handleBlockAccount,
  handleCancelDeletion,
  handleIssuePasswordReset,
  handleScheduleDeletion,
  handleUnblockAccount,
  handleUpdateAccount,
} from "@/server/admin/manage-accounts";
import type { AccountDeps } from "@/server/admin/manage-accounts";
import { getClientIp } from "@/server/auth/client-ip";
import { admitAttemptInTransaction } from "@/server/auth/login-deps";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireAdmin } from "@/server/auth/session";
import { generateToken } from "@/server/auth/tokens";
import { withTransaction } from "@/server/db/pool";
import { sendEmail } from "@/server/email/mailer";
import { sendPasswordResetEmail } from "@/server/email/password-reset-email";
import { sendEmailChangedAlert } from "@/server/email/security-alert-email";
import { emailSendKeys } from "@/server/email/send-limit";

function deps(): AccountDeps {
  return { transaction: withTransaction, now: () => new Date(), generateToken };
}

function revalidateAccount(accountId: string): void {
  revalidatePath(ACCOUNTS_PATH);
  revalidatePath(accountPath(accountId));
}

/** Refus communs à plusieurs formulaires. */
type Refusal =
  | { status: "not_found" }
  | { status: "self" }
  | { status: "last_admin" }
  | { status: "deletion_pending" };

// ─── Informations ───────────────────────────────────────────────────────────

export type AccountDetailsState =
  | { status: "idle" }
  | { status: "invalid"; issues: readonly AccountEditIssue[] }
  | { status: "email_taken" }
  | { status: "not_found" }
  | { status: "self_demotion" }
  | { status: "last_admin" }
  /** `alertSent` : `null` si l'email n'a pas changé. */
  | { status: "updated"; alertSent: boolean | null };

export async function updateAccountAction(
  _previous: AccountDetailsState,
  formData: FormData,
): Promise<AccountDetailsState> {
  const admin = await requireAdmin();
  const result = await handleUpdateAccount(deps(), admin.id, formData);
  if (result.status !== "updated") {
    return result;
  }
  const ip = getClientIp(await headers());
  await recordSecurityEvent({
    type: "account_updated",
    userId: admin.id,
    targetUserId: result.accountId,
    ip,
  });
  let alertSent: boolean | null = null;
  if (result.previousEmail !== null) {
    alertSent = await sendEmailChangedAlert(
      {
        send: sendEmail,
        onError: (errorName) => {
          console.error(`[comptes] alerte de changement d'email non envoyée (${errorName})`);
        },
      },
      { previousEmail: result.previousEmail, newEmail: result.email },
    );
  }
  revalidateAccount(result.accountId);
  return { status: "updated", alertSent };
}

// ─── Mot de passe ───────────────────────────────────────────────────────────

export type PasswordLinkState =
  | { status: "idle" }
  | { status: "not_found" }
  | { status: "deletion_pending" }
  | { status: "rate_limited"; retryAfterMinutes: number }
  | { status: "sent"; email: string; emailSent: boolean };

export async function sendPasswordLinkAction(
  _previous: PasswordLinkState,
  formData: FormData,
): Promise<PasswordLinkState> {
  const admin = await requireAdmin();
  const ip = getClientIp(await headers());
  // Même limite d'envois que les invitations (§6.6), AVANT toute création.
  const admission = await admitAttemptInTransaction(emailSendKeys(admin.id, ip), new Date());
  if (!admission.admitted) {
    return {
      status: "rate_limited",
      retryAfterMinutes: Math.max(1, Math.ceil(admission.retryAfterSeconds / 60)),
    };
  }
  const result = await handleIssuePasswordReset(deps(), formData);
  if (result.status !== "issued") {
    return result;
  }
  const emailSent = await sendPasswordResetEmail(
    {
      send: sendEmail,
      appUrl: getEnv().APP_URL,
      onError: (errorName) => {
        console.error(`[comptes] lien de mot de passe non envoyé (${errorName})`);
      },
    },
    { email: result.email, token: result.token },
  );
  await recordSecurityEvent({
    type: "account_password_reset_sent",
    userId: admin.id,
    targetUserId: result.accountId,
    ip,
  });
  return { status: "sent", email: result.email, emailSent };
}

// ─── Blocage ────────────────────────────────────────────────────────────────

export type BlockState =
  | { status: "idle" }
  | { status: "invalid"; issue: BlockIssue }
  | Refusal
  /** `until` en ISO, `null` = jusqu'à déblocage. */
  | { status: "blocked"; until: string | null };

export async function blockAccountAction(
  _previous: BlockState,
  formData: FormData,
): Promise<BlockState> {
  const admin = await requireAdmin();
  const result = await handleBlockAccount(deps(), admin.id, formData);
  if (result.status !== "blocked") {
    return result;
  }
  await recordSecurityEvent({
    type: "account_blocked",
    userId: admin.id,
    targetUserId: result.accountId,
    ip: getClientIp(await headers()),
  });
  revalidateAccount(result.accountId);
  return { status: "blocked", until: result.until?.toISOString() ?? null };
}

export type UnblockState = { status: "idle" } | { status: "not_found" } | { status: "unblocked" };

export async function unblockAccountAction(
  _previous: UnblockState,
  formData: FormData,
): Promise<UnblockState> {
  const admin = await requireAdmin();
  const result = await handleUnblockAccount(deps(), formData);
  if (result.status !== "unblocked") {
    return result;
  }
  await recordSecurityEvent({
    type: "account_unblocked",
    userId: admin.id,
    targetUserId: result.accountId,
    ip: getClientIp(await headers()),
  });
  revalidateAccount(result.accountId);
  return { status: "unblocked" };
}

// ─── Suppression ────────────────────────────────────────────────────────────

export type DeletionState =
  | { status: "idle" }
  | { status: "confirmation_mismatch" }
  | Refusal
  | { status: "scheduled"; dueAt: string }
  | { status: "cancelled" };

export async function scheduleDeletionAction(
  _previous: DeletionState,
  formData: FormData,
): Promise<DeletionState> {
  const admin = await requireAdmin();
  const result = await handleScheduleDeletion(deps(), admin.id, formData);
  if (result.status !== "scheduled") {
    return result;
  }
  await recordSecurityEvent({
    type: "account_deletion_scheduled",
    userId: admin.id,
    targetUserId: result.accountId,
    ip: getClientIp(await headers()),
  });
  revalidateAccount(result.accountId);
  return { status: "scheduled", dueAt: result.dueAt.toISOString() };
}

export async function cancelDeletionAction(
  _previous: DeletionState,
  formData: FormData,
): Promise<DeletionState> {
  const admin = await requireAdmin();
  const result = await handleCancelDeletion(deps(), formData);
  if (result.status !== "cancelled") {
    return result;
  }
  await recordSecurityEvent({
    type: "account_deletion_cancelled",
    userId: admin.id,
    targetUserId: result.accountId,
    ip: getClientIp(await headers()),
  });
  revalidateAccount(result.accountId);
  return { status: "cancelled" };
}
