/**
 * Éléments de formulaire partagés (barèmes, indemnités) : champ avec libellé, aide et
 * erreur reliées (§7.4), et message de résultat. Sans état : utilisables partout.
 */
import type { ReactNode } from "react";
import type { ScaleMessage } from "./scale-messages";

export const FIELD_CLASS =
  "min-h-11 w-full rounded-md border border-input px-3 py-2 aria-[invalid=true]:border-destructive";
export const PRIMARY_BUTTON_CLASS =
  "min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60";
export const SECONDARY_BUTTON_CLASS =
  "min-h-11 rounded-md border border-input px-4 disabled:opacity-60";
/**
 * Bouton d'envoi d'un formulaire (bloc 13) : pleine largeur sur téléphone, à la taille de
 * son texte à partir de `md`. Un seul bouton principal par formulaire.
 */
export const SUBMIT_BUTTON_CLASS = `${PRIMARY_BUTTON_CLASS} w-full md:w-auto md:self-start`;
/** Ouvre la suppression d'une ressource (match, note, barème) : contour rouge (bloc 13). */
export const DANGER_BUTTON_CLASS =
  "min-h-11 rounded-md border border-destructive px-4 font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60";
/** Confirme une action destructive (deuxième temps) : plein rouge. */
export const DESTRUCTIVE_BUTTON_CLASS =
  "min-h-11 rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground disabled:opacity-60";
/** Bouton radio des formulaires de réglages (apparence, thème saisonnier). */
export const RADIO_INPUT_CLASS = "size-4 shrink-0 accent-primary";
/** Suppression en icône (bloc 10) : corbeille rouge dans une case rouge, 44 px. */
export const DANGER_ICON_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:opacity-60";

type FieldProps = {
  id: string;
  label: string;
  error: string | null;
  hint?: string | undefined;
  /** Le contrôle du champ ; reçoit l'`aria-describedby` à poser (aide et erreur reliées). */
  children: (describedBy: string | undefined) => ReactNode;
};

/** Enveloppe d'un champ : libellé, aide et erreur reliées au contrôle (§7.4). */
export function Field({ id, label, error, hint, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint !== undefined ? hintId : null, error !== null ? errorId : null]
      .filter((value) => value !== null)
      .join(" ") || undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(describedBy)}
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== null && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error: string | null;
  hint?: string;
  type?: "text" | "date" | "time" | "email";
  inputMode?: "decimal";
  maxLength?: number;
  /** Champ obligatoire (par défaut). */
  required?: boolean;
  /** Valeur de `autocomplete` (ex. `given-name`) ; désactivé par défaut. */
  autoComplete?: string;
};

export function TextField({
  id,
  name,
  label,
  defaultValue,
  error,
  hint,
  type = "text",
  inputMode,
  maxLength,
  required = true,
  autoComplete = "off",
}: TextFieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      {(describedBy) => (
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          defaultValue={defaultValue}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={error !== null}
          aria-describedby={describedBy}
          className={FIELD_CLASS}
        />
      )}
    </Field>
  );
}

/** Résultat d'une action, annoncé aux lecteurs d'écran (`alert` pour une erreur). */
export function FormMessage({ message }: { message: ScaleMessage | null }) {
  if (message === null) {
    return null;
  }
  return message.tone === "error" ? (
    <p
      role="alert"
      data-form-message=""
      className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
    >
      {message.text}
    </p>
  ) : (
    <p
      role="status"
      data-form-message=""
      className="border-l-4 border-success pl-3 text-sm font-medium"
    >
      {message.text}
    </p>
  );
}
