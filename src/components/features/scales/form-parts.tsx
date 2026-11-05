/**
 * Éléments de formulaire partagés (barèmes, indemnités) : champ avec libellé, aide et
 * erreur reliées (§7.4), et message de résultat. Sans état : utilisables partout.
 */
import type { ScaleMessage } from "./scale-messages";

export const FIELD_CLASS =
  "min-h-11 w-full rounded-md border border-input px-3 py-2 aria-[invalid=true]:border-destructive";
export const PRIMARY_BUTTON_CLASS =
  "min-h-11 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60";
export const SECONDARY_BUTTON_CLASS =
  "min-h-11 rounded-md border border-input px-4 disabled:opacity-60";

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error: string | null;
  hint?: string;
  type?: "text" | "date" | "time";
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
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint !== undefined ? hintId : null, error !== null ? errorId : null]
    .filter((value) => value !== null)
    .join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
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
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className={FIELD_CLASS}
      />
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

/** Résultat d'une action, annoncé aux lecteurs d'écran (`alert` pour une erreur). */
export function FormMessage({ message }: { message: ScaleMessage | null }) {
  if (message === null) {
    return null;
  }
  return message.tone === "error" ? (
    <p
      role="alert"
      className="border-l-4 border-destructive pl-3 text-sm font-medium text-destructive"
    >
      {message.text}
    </p>
  ) : (
    <p role="status" className="border-l-4 border-success pl-3 text-sm font-medium">
      {message.text}
    </p>
  );
}
