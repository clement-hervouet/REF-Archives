"use client";

/**
 * Gestion des catégories d'axes d'amélioration : une liste compacte, dans l'ordre choisi.
 *  * Ordre : un bouton « monter » et un bouton « descendre » par catégorie. Chaque
 *    déplacement s'affiche aussitôt (état optimiste) et part au serveur avec l'ordre complet ;
 *    les envois se suivent dans l'ordre des clics. Le focus reste sur le bouton utilisé (ou
 *    passe à l'autre en bout de liste) et la nouvelle position est annoncée.
 *  * Catégories personnelles : ajout en fin de liste, renommage sur place.
 *  * Suppression confirmée de toute catégorie (le texte part avec). Une catégorie par défaut
 *    supprimée est listée à part, avec un bouton pour la rétablir.
 */
import { ArrowDown, ArrowUp, Pencil, RotateCcw } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import {
  FIELD_CLASS,
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { IMPROVEMENT_CUSTOM_MAX, IMPROVEMENT_LABEL_MAX } from "@/lib/improvement-axes-fields";
import type {
  AxisLabelError,
  CreateImprovementAxisState,
  DeleteImprovementAxisState,
  RenameImprovementAxisState,
  ReorderImprovementAxesState,
  RestoreImprovementAxisState,
} from "@/server/improvement/manage-improvement-axes";

const t = fr.improvementAxes.manage;

/** Un axe tel qu'affiché : nom traduit (axe par défaut) ou choisi (catégorie personnelle). */
export type AxisLabel = { slot: string; label: string; custom: boolean };

type Direction = "up" | "down";

type Action<S> = (previous: S, formData: FormData) => Promise<S>;

type ImprovementAxesActions = {
  reorder: Action<ReorderImprovementAxesState>;
  create: Action<CreateImprovementAxisState>;
  rename: Action<RenameImprovementAxisState>;
  remove: Action<DeleteImprovementAxisState>;
  restore: Action<RestoreImprovementAxisState>;
};

type Props = {
  axes: readonly AxisLabel[];
  /** Catégories par défaut supprimées, à rétablir. */
  restorable: readonly AxisLabel[];
  actions: ImprovementAxesActions;
};

const ICON_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-input hover:bg-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent";

function moved(slots: readonly string[], index: number, direction: Direction): string[] {
  const target = direction === "up" ? index - 1 : index + 1;
  const next = [...slots];
  const [slot] = next.splice(index, 1);
  if (slot !== undefined) {
    next.splice(target, 0, slot);
  }
  return next;
}

function labelErrorText(error: AxisLabelError): string {
  switch (error) {
    case "required":
      return t.errors.required;
    case "too_long":
      return t.errors.tooLong;
    case "invalid":
      return t.errors.invalid;
    case "duplicate":
      return t.errors.duplicate;
  }
}

export function ImprovementAxesManager({ axes, restorable, actions }: Props) {
  const [state, dispatch, isPending] = useActionState<ReorderImprovementAxesState, FormData>(
    actions.reorder,
    { status: "idle" },
  );
  const [slots, setOptimisticSlots] = useOptimistic(axes.map((axis) => axis.slot));
  const [announcement, setAnnouncement] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  /** Dernière catégorie dont le renommage s'est fermé (focus à rendre). */
  const [renamed, setRenamed] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const focusAfterMove = useRef<{ slot: string; direction: Direction } | null>(null);
  const customCount = axes.filter((axis) => axis.custom).length;
  const restoreTitleId = useId();

  const axisOf = (slot: string): AxisLabel | undefined => axes.find((axis) => axis.slot === slot);

  /** Bouton d'une ligne (`data-axis-button`), pour y remettre le focus après un rendu. */
  const focusButton = (key: string) => {
    list.current
      ?.querySelector<HTMLButtonElement>(`[data-axis-button="${CSS.escape(key)}"]`)
      ?.focus();
  };

  // Après le déplacement, la ligne a pu être retirée puis réinsérée dans le DOM (focus perdu).
  useEffect(() => {
    const wanted = focusAfterMove.current;
    if (wanted === null) {
      return;
    }
    focusAfterMove.current = null;
    const index = slots.indexOf(wanted.slot);
    const atEdge = wanted.direction === "up" ? index === 0 : index === slots.length - 1;
    const direction = atEdge ? (wanted.direction === "up" ? "down" : "up") : wanted.direction;
    focusButton(`${wanted.slot}:${direction}`);
  }, [slots]);

  function move(index: number, direction: Direction) {
    const slot = slots[index];
    const outside = direction === "up" ? index === 0 : index === slots.length - 1;
    if (slot === undefined || outside) {
      return;
    }
    const next = moved(slots, index, direction);
    const formData = new FormData();
    for (const value of next) {
      formData.append("order", value);
    }
    focusAfterMove.current = { slot, direction };
    setAnnouncement(
      t.moved
        .replace("{label}", axisOf(slot)?.label ?? "")
        .replace("{position}", String(next.indexOf(slot) + 1))
        .replace("{total}", String(next.length)),
    );
    startTransition(() => {
      setOptimisticSlots(next);
      dispatch(formData);
    });
  }

  // Fin du renommage : le bouton « Renommer » réapparaît, le focus y revient.
  useEffect(() => {
    if (renamed !== null && editing === null) {
      focusButton(`${renamed}:rename`);
    }
  }, [renamed, editing]);

  function closeRename(slot: string) {
    setEditing(null);
    setRenamed(slot);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {slots.length > 0 && (
        <ol ref={list} aria-label={t.listLabel} className="flex flex-col gap-2">
          {slots.map((slot, index) => {
            const axis = axisOf(slot);
            if (axis === undefined) {
              return null;
            }
            return (
              <li
                key={slot}
                className="flex min-h-13 flex-wrap items-center gap-2 rounded-md border border-border py-1 pr-1 pl-3"
              >
                <span
                  aria-hidden="true"
                  className="w-6 shrink-0 text-muted-foreground tabular-nums"
                >
                  {index + 1}.
                </span>
                {editing === slot ? (
                  <RenameAxisForm
                    axis={axis}
                    action={actions.rename}
                    onClose={() => {
                      closeRename(slot);
                    }}
                  />
                ) : (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium break-words">{axis.label}</span>
                      {axis.custom && (
                        <span className="text-xs text-muted-foreground">{t.customTag}</span>
                      )}
                    </span>
                    {axis.custom && (
                      <button
                        data-axis-button={`${slot}:rename`}
                        type="button"
                        aria-label={t.rename.open.replace("{label}", axis.label)}
                        title={t.rename.open.replace("{label}", axis.label)}
                        onClick={() => {
                          setEditing(slot);
                        }}
                        className={ICON_BUTTON_CLASS}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </button>
                    )}
                    <ConfirmActionButton
                      variant="icon"
                      action={actions.remove}
                      hidden={{ name: "slot", value: slot }}
                      labels={{
                        submit: t.remove.confirm,
                        ariaLabel: t.remove.open.replace("{label}", axis.label),
                        warning: (axis.custom ? t.remove.warning : t.remove.warningDefault).replace(
                          "{label}",
                          axis.label,
                        ),
                        confirm: t.remove.confirm,
                        cancel: t.remove.cancel,
                      }}
                      messages={{ notFound: t.errors.notFound }}
                    />
                  </>
                )}
                {/* Pendant le renommage, la ligne ne porte que le formulaire. */}
                {editing !== slot && (
                  <MoveButtons
                    slot={slot}
                    label={axis.label}
                    first={index === 0}
                    last={index === slots.length - 1}
                    onMove={(direction) => {
                      move(index, direction);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {state.status === "stale" && !isPending ? (
        <FormMessage message={{ tone: "error", text: t.stale }} />
      ) : (
        <p aria-hidden="true" className="min-h-5 text-sm text-muted-foreground">
          {isPending ? t.saving : state.status === "reordered" ? t.saved : ""}
        </p>
      )}
      {restorable.length > 0 && (
        <section aria-labelledby={restoreTitleId} className="flex flex-col gap-2">
          <h3 id={restoreTitleId} className="text-sm font-medium">
            {t.restore.title}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {restorable.map((axis) => (
              <li key={axis.slot}>
                <RestoreAxisButton axis={axis} action={actions.restore} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <CreateAxisForm action={actions.create} full={customCount >= IMPROVEMENT_CUSTOM_MAX} />
    </div>
  );
}

/** Flèches « monter » et « descendre » d'une ligne. */
function MoveButtons({
  slot,
  label,
  first,
  last,
  onMove,
}: {
  slot: string;
  label: string;
  first: boolean;
  last: boolean;
  onMove: (direction: Direction) => void;
}) {
  return (["up", "down"] as const).map((direction) => {
    const disabled = direction === "up" ? first : last;
    const name = (direction === "up" ? t.moveUp : t.moveDown).replace("{label}", label);
    const Icon = direction === "up" ? ArrowUp : ArrowDown;
    return (
      <button
        key={direction}
        data-axis-button={`${slot}:${direction}`}
        type="button"
        aria-label={name}
        title={name}
        // `aria-disabled` plutôt que `disabled` : le bouton garde le focus quand la
        // catégorie arrive en bout de liste.
        aria-disabled={disabled}
        onClick={() => {
          onMove(direction);
        }}
        className={ICON_BUTTON_CLASS}
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    );
  });
}

function RenameAxisForm({
  axis,
  action,
  onClose,
}: {
  axis: AxisLabel;
  action: Action<RenameImprovementAxisState>;
  onClose: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    async (previous: RenameImprovementAxisState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.status === "renamed") {
        onClose();
      }
      return next;
    },
    { status: "idle" },
    ["renamed"],
    { label: axis.label },
  );
  const error =
    state.status === "invalid"
      ? labelErrorText(state.error)
      : state.status === "notFound"
        ? t.errors.notFound
        : null;

  useEffect(() => {
    input.current?.focus();
  }, [formKey]);

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex min-w-0 flex-1 basis-48 flex-col gap-2 py-1"
    >
      <input type="hidden" name="slot" value={axis.slot} />
      <label htmlFor={id} className="sr-only">
        {t.rename.label.replace("{label}", axis.label)}
      </label>
      <input
        ref={input}
        id={id}
        name="label"
        defaultValue={valueOf("label")}
        maxLength={IMPROVEMENT_LABEL_MAX}
        required
        autoComplete="off"
        aria-invalid={error !== null}
        aria-describedby={error !== null ? `${id}-error` : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
          }
        }}
        className={FIELD_CLASS}
      />
      {error !== null && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className={PRIMARY_BUTTON_CLASS}>
          {isPending ? t.rename.submitting : t.rename.submit}
        </button>
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON_CLASS}>
          {t.rename.cancel}
        </button>
      </div>
    </form>
  );
}

/** Rétablit une catégorie par défaut supprimée : elle revient en fin de liste, texte vide. */
function RestoreAxisButton({
  axis,
  action,
}: {
  axis: AxisLabel;
  action: Action<RestoreImprovementAxisState>;
}) {
  const [, formAction, isPending] = useActionState<RestoreImprovementAxisState, FormData>(action, {
    status: "idle",
  });
  const name = t.restore.label.replace("{label}", axis.label);
  return (
    <form action={formAction}>
      <input type="hidden" name="slot" value={axis.slot} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={name}
        title={name}
        className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center gap-2`}
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        {isPending ? t.restore.submitting : axis.label}
      </button>
    </form>
  );
}

function createMessage(state: CreateImprovementAxisState) {
  switch (state.status) {
    case "idle":
    case "invalid":
      return null;
    case "created":
      return { tone: "success", text: t.create.created } as const;
    case "limit":
      return { tone: "error", text: t.errors.limit } as const;
  }
}

function CreateAxisForm({
  action,
  full,
}: {
  action: Action<CreateImprovementAxisState>;
  /** Nombre maximal de catégories personnelles atteint : l'ajout est fermé. */
  full: boolean;
}) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["created"],
  );
  const error = state.status === "invalid" ? labelErrorText(state.error) : null;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [full ? hintId : null, error !== null ? errorId : null]
    .filter((value) => value !== null)
    .join(" ");

  return (
    <form
      key={formKey}
      action={formAction}
      className="flex flex-col gap-2 border-t border-border pt-4"
    >
      <label htmlFor={id} className="text-sm font-medium">
        {t.create.label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="label"
          defaultValue={valueOf("label")}
          placeholder={t.create.placeholder}
          maxLength={IMPROVEMENT_LABEL_MAX}
          required
          disabled={full}
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={describedBy || undefined}
          className={`${FIELD_CLASS} sm:flex-1`}
        />
        <button
          type="submit"
          disabled={full || isPending}
          className={`${PRIMARY_BUTTON_CLASS} shrink-0`}
        >
          {isPending ? t.create.submitting : t.create.submit}
        </button>
      </div>
      {full && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {t.errors.limit}
        </p>
      )}
      {error !== null && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <FormMessage message={createMessage(state)} />
    </form>
  );
}
