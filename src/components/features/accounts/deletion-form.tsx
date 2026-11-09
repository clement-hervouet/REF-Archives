"use client";

/**
 * Suppression différée d'un compte (bloc 10). Programmer : l'admin retape l'email du
 * compte, qui est coupé tout de suite et effacé au bout de 30 jours. Tant que la date
 * n'est pas passée, « Annuler la suppression » le rétablit.
 */
import { useActionState, useId } from "react";
import {
  FIELD_CLASS,
  FormMessage,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { DeletionState } from "@/app/(app)/admin/comptes/actions";
import { deletionMessage } from "./account-messages";

const t = fr.admin.accounts.sections.deletion;

type Props = {
  scheduleAction: (previous: DeletionState, formData: FormData) => Promise<DeletionState>;
  cancelAction: (previous: DeletionState, formData: FormData) => Promise<DeletionState>;
  accountId: string;
  /** Suppression programmée : date déjà mise en forme, sinon `null`. */
  pendingDate: string | null;
};

export function DeletionForm({ scheduleAction, cancelAction, accountId, pendingDate }: Props) {
  const id = useId();
  const [scheduleState, scheduleFormAction, scheduling] = useActionState<DeletionState, FormData>(
    scheduleAction,
    { status: "idle" },
  );
  const [cancelState, cancelFormAction, cancelling] = useActionState<DeletionState, FormData>(
    cancelAction,
    { status: "idle" },
  );

  if (pendingDate !== null) {
    return (
      <div className="flex flex-col gap-3">
        <FormMessage message={deletionMessage(scheduleState)} />
        <FormMessage message={deletionMessage(cancelState)} />
        <div className="flex flex-col gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">{t.pending.replace("{date}", pendingDate)}</p>
          <form action={cancelFormAction}>
            <input type="hidden" name="accountId" value={accountId} />
            <button
              type="submit"
              disabled={cancelling}
              className={`${SECONDARY_BUTTON_CLASS} bg-background whitespace-nowrap`}
            >
              {cancelling ? t.cancelling : t.cancel}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormMessage message={deletionMessage(scheduleState)} />
      <FormMessage message={deletionMessage(cancelState)} />
      <form action={scheduleFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="accountId" value={accountId} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-confirm`} className="text-sm font-medium">
            {t.confirm}
          </label>
          <input
            id={`${id}-confirm`}
            name="confirmEmail"
            type="email"
            required
            autoComplete="off"
            spellCheck={false}
            aria-invalid={scheduleState.status === "confirmation_mismatch"}
            className={`${FIELD_CLASS} sm:max-w-md`}
          />
        </div>
        <button
          type="submit"
          disabled={scheduling}
          className="min-h-11 self-start rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground disabled:opacity-60"
        >
          {scheduling ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
