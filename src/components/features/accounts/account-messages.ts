/**
 * Messages des formulaires de la fiche d'un compte (bloc 10). Purs et sans React : les
 * dates arrivent en ISO et sont mises en forme ici.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import type { AccountEditIssue, BlockIssue } from "@/lib/schemas/accounts";
import type {
  AccountDetailsState,
  BlockState,
  DeletionState,
  PasswordLinkState,
  UnblockState,
} from "@/app/(app)/admin/comptes/actions";

const t = fr.admin.accounts;
const err = t.errors;
const ok = t.messages;

const error = (text: string): ScaleMessage => ({ tone: "error", text });
const success = (text: string): ScaleMessage => ({ tone: "success", text });

/** Refus communs (introuvable, soi-même, dernier admin, suppression programmée). */
function refusal(status: string): ScaleMessage | null {
  switch (status) {
    case "not_found":
      return error(err.notFound);
    case "self":
      return error(err.self);
    case "last_admin":
      return error(err.lastAdmin);
    case "deletion_pending":
      return error(err.deletionPending);
    default:
      return null;
  }
}

export function detailsMessage(state: AccountDetailsState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "invalid":
      return error(err.invalid);
    case "email_taken":
      return error(err.emailTaken);
    case "self_demotion":
      return error(err.selfDemotion);
    case "updated":
      if (state.alertSent === null) return success(ok.updated);
      return state.alertSent ? success(ok.updatedAlertSent) : error(ok.updatedAlertFailed);
    default:
      return refusal(state.status);
  }
}

/** Erreur sous un champ des informations, ou `null`. */
export function detailsFieldError(
  state: AccountDetailsState,
  field: "email" | "role",
): string | null {
  if (state.status === "email_taken" && field === "email") {
    return err.emailTaken;
  }
  if (state.status !== "invalid") {
    return null;
  }
  const code: AccountEditIssue = field === "email" ? "email.invalid" : "role.invalid";
  if (!state.issues.includes(code)) {
    return null;
  }
  return field === "email" ? err.email : err.role;
}

export function passwordLinkMessage(state: PasswordLinkState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "rate_limited":
      return error(err.rateLimited.replace("{minutes}", String(state.retryAfterMinutes)));
    case "sent":
      return state.emailSent
        ? success(ok.resetSent.replace("{email}", () => state.email))
        : error(ok.resetNotSent);
    default:
      return refusal(state.status);
  }
}

const BLOCK_ISSUES: Record<BlockIssue, string> = {
  "mode.invalid": err.blockMode,
  "date.invalid": err.blockDate,
  "date.past": err.blockDatePast,
  "date.too_far": err.blockDateTooFar,
};

export function blockMessage(state: BlockState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "invalid":
      return error(BLOCK_ISSUES[state.issue]);
    case "blocked":
      return state.until === null
        ? success(ok.blockedIndefinite)
        : success(ok.blocked.replace("{date}", formatDateTime(new Date(state.until))));
    default:
      return refusal(state.status);
  }
}

export function unblockMessage(state: UnblockState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "unblocked":
      return success(ok.unblocked);
    case "not_found":
      return error(err.notFound);
  }
}

export function deletionMessage(state: DeletionState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "confirmation_mismatch":
      return error(err.confirmation);
    case "scheduled":
      return success(ok.scheduled.replace("{date}", formatDateTime(new Date(state.dueAt))));
    case "cancelled":
      return success(ok.cancelled);
    default:
      return refusal(state.status);
  }
}
