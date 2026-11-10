"use client";

/**
 * Blocage d'un compte (bloc 10) : 24 heures, 7 jours, 30 jours, jusqu'à une date ou jusqu'à
 * déblocage. Le compte bloqué est déconnecté partout immédiatement. « Débloquer
 * maintenant » apparaît tant qu'un blocage est en cours.
 */
import { useActionState, useId, useState } from "react";
import {
  FIELD_CLASS,
  FormMessage,
  SECONDARY_BUTTON_CLASS,
  SUBMIT_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { BLOCK_MODES } from "@/lib/schemas/accounts";
import type { BlockMode } from "@/lib/schemas/accounts";
import type { BlockState, UnblockState } from "@/app/(app)/admin/comptes/actions";
import { blockMessage, unblockMessage } from "./account-messages";

const t = fr.admin.accounts.sections.block;

type Props = {
  blockAction: (previous: BlockState, formData: FormData) => Promise<BlockState>;
  unblockAction: (previous: UnblockState, formData: FormData) => Promise<UnblockState>;
  accountId: string;
  /** Blocage en cours : texte déjà mis en forme (« Bloqué jusqu'au … »), sinon `null`. */
  current: string | null;
  /** Demain, à Paris (`AAAA-MM-JJ`) : première date possible. */
  minDate: string;
};

export function BlockForm({ blockAction, unblockAction, accountId, current, minDate }: Props) {
  const id = useId();
  const [mode, setMode] = useState<BlockMode>("7d");
  const [blockState, blockFormAction, blocking] = useActionState<BlockState, FormData>(
    blockAction,
    { status: "idle" },
  );
  const [unblockState, unblockFormAction, unblocking] = useActionState<UnblockState, FormData>(
    unblockAction,
    { status: "idle" },
  );

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={blockMessage(blockState)} />
      <FormMessage message={unblockMessage(unblockState)} />
      {current !== null && (
        <div className="flex flex-col gap-3 rounded-md border border-warning bg-warning/15 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">{current}</p>
          <form action={unblockFormAction}>
            <input type="hidden" name="accountId" value={accountId} />
            <button
              type="submit"
              disabled={unblocking}
              className={`${SECONDARY_BUTTON_CLASS} bg-background whitespace-nowrap`}
            >
              {unblocking ? t.unblocking : t.unblock}
            </button>
          </form>
        </div>
      )}
      <form action={blockFormAction} className="flex flex-col gap-4">
        <input type="hidden" name="accountId" value={accountId} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t.legend}</legend>
          <div className="flex flex-wrap gap-2">
            {BLOCK_MODES.map((option) => (
              <label
                key={option}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-3 has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
              >
                <input
                  type="radio"
                  name="mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => {
                    setMode(option);
                  }}
                  className="size-4 accent-primary"
                />
                {t.modes[option]}
              </label>
            ))}
          </div>
        </fieldset>
        {mode === "date" && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-date`} className="text-sm font-medium">
              {t.date}
            </label>
            <input
              id={`${id}-date`}
              name="date"
              type="date"
              required
              min={minDate}
              aria-describedby={`${id}-date-hint`}
              className={`${FIELD_CLASS} sm:max-w-xs`}
            />
            <p id={`${id}-date-hint`} className="text-sm text-muted-foreground">
              {t.dateHint}
            </p>
          </div>
        )}
        <button type="submit" disabled={blocking} className={SUBMIT_BUTTON_CLASS}>
          {blocking ? t.submitting : current === null ? t.submit : t.change}
        </button>
      </form>
    </div>
  );
}
