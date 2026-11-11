/**
 * Liste déroulante contrôlée avec libellé, aide et erreur reliées (§7.4).
 * Les options sont passées en `children` (`<option>`, `<optgroup>`).
 */
import type { ReactNode } from "react";
import { FIELD_CLASS, Field } from "@/components/features/scales/form-parts";

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
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      {(describedBy) => (
        <select
          id={id}
          name={name}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          required
          aria-invalid={error !== null}
          aria-describedby={describedBy}
          className={FIELD_CLASS}
        >
          {children}
        </select>
      )}
    </Field>
  );
}
