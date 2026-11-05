"use client";

/**
 * Action destructive en deux temps (suppression d'un match, d'une note, d'un collègue) :
 * un premier clic demande une confirmation explicite. Les messages arrivent déjà traduits
 * et indexés par statut (props sérialisables, la page étant un Server Component).
 */
import { useActionState, useState } from "react";
import { SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";

type Labels = {
  submit: string;
  /** Étiquette accessible du premier bouton (ex. « Supprimer Alex Martin »). */
  ariaLabel?: string;
  warning: string;
  confirm: string;
  cancel: string;
};

type ActionState = { status: string };

type Props = {
  /**
   * Server Action dont l'état de départ est `{ status: "idle" }`. Elle reçoit toujours cet
   * état : ces actions n'utilisent pas l'état précédent, et ce type accepte chacune
   * d'elles sans générique (`useActionState` gère mal les états génériques).
   */
  action: (previous: { status: "idle" }, formData: FormData) => Promise<ActionState>;
  hidden: { name: string; value: string };
  labels: Labels;
  /** Message affiché selon le statut renvoyé ; `successStatuses` les annonce en succès. */
  messages: Readonly<Record<string, string>>;
  successStatuses?: readonly string[];
};

const IDLE = { status: "idle" } as const;

export function ConfirmActionButton({
  action,
  hidden,
  labels,
  messages,
  successStatuses = [],
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const next = await action(IDLE, formData);
      setConfirming(false);
      return next;
    },
    IDLE,
  );
  const message = messages[state.status];
  const success = successStatuses.includes(state.status);

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        {message !== undefined &&
          (success ? (
            <p role="status" className="border-l-4 border-success pl-3 text-sm font-medium">
              {message}
            </p>
          ) : (
            <p
              role="alert"
              className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
            >
              {message}
            </p>
          ))}
        <button
          type="button"
          aria-label={labels.ariaLabel}
          onClick={() => {
            setConfirming(true);
          }}
          className={`${SECONDARY_BUTTON_CLASS} self-start`}
        >
          {labels.submit}
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-destructive p-3"
    >
      <input type="hidden" name={hidden.name} value={hidden.value} />
      <p className="text-sm">{labels.warning}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground disabled:opacity-60"
        >
          {labels.confirm}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
          }}
          className={SECONDARY_BUTTON_CLASS}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
