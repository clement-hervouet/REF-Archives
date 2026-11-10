"use client";

/**
 * Action destructive en deux temps (suppression d'un match, d'une note, d'un collègue) :
 * un premier clic demande une confirmation explicite. Les messages arrivent déjà traduits
 * et indexés par statut (props sérialisables, la page étant un Server Component).
 *
 * Variante `icon` (bloc 10) : une corbeille dans une case rouge. Ses éléments se placent directement
 * dans la rangée du parent (`display: contents`) : le message et la confirmation y passent
 * sur une ligne entière, en dessous.
 */
import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import {
  DANGER_BUTTON_CLASS,
  DANGER_ICON_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";

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
  variant?: "button" | "icon";
};

const IDLE = { status: "idle" } as const;

export function ConfirmActionButton({
  action,
  hidden,
  labels,
  messages,
  successStatuses = [],
  variant = "button",
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
  const icon = variant === "icon";

  if (!confirming && icon) {
    return (
      <div className="contents">
        <button
          type="button"
          aria-label={labels.ariaLabel ?? labels.submit}
          title={labels.ariaLabel ?? labels.submit}
          onClick={() => {
            setConfirming(true);
          }}
          className={DANGER_ICON_BUTTON_CLASS}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
        {message !== undefined && (
          <p
            role={success ? "status" : "alert"}
            className={
              success
                ? "order-last basis-full border-l-4 border-success pl-3 text-sm font-medium"
                : "order-last basis-full border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
            }
          >
            {message}
          </p>
        )}
      </div>
    );
  }

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
          className={`${DANGER_BUTTON_CLASS} self-start`}
        >
          {labels.submit}
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={`flex flex-col gap-3 rounded-md border border-destructive p-3 ${icon ? "order-last basis-full" : ""}`}
    >
      <input type="hidden" name={hidden.name} value={hidden.value} />
      <p className="text-sm">{labels.warning}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className={DESTRUCTIVE_BUTTON_CLASS}>
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
