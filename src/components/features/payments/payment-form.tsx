"use client";

/**
 * Validation des paiements (bloc 10) : sélection libre des indemnités reçues, total de la
 * sélection, date du paiement (aujourd'hui par défaut). Le serveur revalide tout (§6.3) et
 * ne modifie que les indemnités de l'utilisateur.
 *
 * Envoi déclenché à la main (`onSubmit` + transition) et non par `<form action>` : React 19
 * réinitialise le formulaire après un envoi par `action`, ce qui décoche les cases dans le
 * DOM alors que l'état React les croit cochées (sélection affichée fausse après une erreur).
 */
import { startTransition, useActionState, useId, useState } from "react";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { formatCents } from "@/lib/format";
import type { MarkPaidState } from "@/server/compensation/payments";
import { markPaidMessage, paymentIssueMessages, selectionLabel } from "./payment-messages";

const t = fr.payments;

/** Ligne affichée, préparée côté serveur (montant déjà calculé). */
export type PayableItem = {
  id: string;
  dateLabel: string;
  teams: string;
  details: string;
  totalCents: number;
};

type Props = {
  items: readonly PayableItem[];
  /** Jour de Paris côté serveur : valeur par défaut et maximum de la date. */
  today: string;
  action: (previous: MarkPaidState, formData: FormData) => Promise<MarkPaidState>;
};

export function PaymentForm({ items, today, action }: Props) {
  const id = useId();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [paidOn, setPaidOn] = useState(today);
  const [state, formAction, isPending] = useActionState<MarkPaidState, FormData>(
    async (previous, formData) => {
      const next = await action(previous, formData);
      if (next.status === "marked" || next.status === "unchanged") {
        // Les indemnités payées disparaissent de la liste (rechargée par le serveur).
        setSelected(new Set());
      }
      return next;
    },
    { status: "idle" },
  );

  // Seules les lignes encore affichées comptent (une indemnité payée ailleurs a disparu).
  const selectedItems = items.filter((item) => selected.has(item.id));
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.totalCents, 0);
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const issues = state.status === "invalid" ? paymentIssueMessages(state.issues) : [];
  const dateId = `${id}-paid-on`;
  const summaryId = `${id}-summary`;

  function toggle(itemId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={markPaidMessage(state)} />
      {issues.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 border-l-4 border-destructive pl-3">
          {issues.map((message) => (
            <p key={message} className="text-sm font-medium text-destructive">
              {message}
            </p>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => {
            formAction(formData);
          });
        }}
        className="flex flex-col gap-4"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t.legend}</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
              }}
              className={SECONDARY_BUTTON_CLASS}
            >
              {allSelected ? t.selectNone : t.selectAll}
            </button>
            <p id={summaryId} aria-live="polite" className="text-sm font-medium tabular-nums">
              {selectionLabel(selectedItems.length, selectedTotal)}
            </p>
          </div>

          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {items.map((item) => {
              const checked = selected.has(item.id);
              return (
                <li key={item.id}>
                  <label
                    className={`flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3 ${checked ? "bg-accent" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="compensationId"
                      value={item.id}
                      checked={checked}
                      onChange={(event) => {
                        toggle(item.id, event.target.checked);
                      }}
                      className="mt-1 size-5 shrink-0 accent-primary"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm text-muted-foreground">{item.dateLabel}</span>
                      <span className="font-semibold break-words">{item.teams}</span>
                      <span className="text-sm break-words text-muted-foreground">
                        {item.details}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCents(item.totalCents)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor={dateId} className="text-sm font-medium">
              {t.paidOn}
            </label>
            <input
              id={dateId}
              name="paidOn"
              type="date"
              required
              max={today}
              value={paidOn}
              onChange={(event) => {
                setPaidOn(event.target.value);
              }}
              aria-describedby={`${dateId}-hint`}
              className="min-h-11 rounded-md border border-input bg-background px-3 py-2 md:w-56"
            />
            <p id={`${dateId}-hint`} className="text-sm text-muted-foreground">
              {t.paidOnHint}
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending || selectedItems.length === 0}
            aria-describedby={summaryId}
            className={`${PRIMARY_BUTTON_CLASS} md:mb-7`}
          >
            {isPending ? t.submitting : t.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
