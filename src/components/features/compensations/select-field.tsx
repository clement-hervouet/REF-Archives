/**
 * Liste déroulante contrôlée avec libellé, aide et erreur reliées (§7.4).
 * Les options sont passées en `children` (`<option>`, `<optgroup>`).
 */
import type { ReactNode } from "react";
import { FIELD_CLASS } from "@/components/features/scales/form-parts";

type Props = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  hint?: string;
  children: ReactNode;
};

export function SelectField({ id, name, label, value, onChange, error, hint, children }: Props) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint !== undefined ? hintId : null, error !== null ? errorId : null]
    .filter((item) => item !== null)
    .join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        required
        aria-invalid={error !== null}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className={FIELD_CLASS}
      >
        {children}
      </select>
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
