/**
 * Trio « date d'application, montant du match, taux km » d'une ligne de barème, partagé par
 * la création d'un barème et l'ajout d'une ligne.
 */
import { fr } from "@/i18n/fr";
import type { ScaleFormField } from "@/lib/schemas/scales";
import { TextField } from "./form-parts";
import { fieldError } from "./scale-messages";

const t = fr.scales;

type Props = {
  idBase: string;
  valueOf: (name: string) => string;
  invalid: readonly ScaleFormField[];
};

export function RateFields({ idBase, valueOf, invalid }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <TextField
        id={`${idBase}-from`}
        name="effectiveFrom"
        type="date"
        label={t.fields.effectiveFrom}
        defaultValue={valueOf("effectiveFrom")}
        error={fieldError("effectiveFrom", invalid)}
      />
      <TextField
        id={`${idBase}-amount`}
        name="gameAmount"
        inputMode="decimal"
        label={t.fields.gameAmount}
        hint={t.fields.gameAmountHint}
        defaultValue={valueOf("gameAmount")}
        error={fieldError("gameAmount", invalid)}
      />
      <TextField
        id={`${idBase}-rate`}
        name="ratePerKm"
        inputMode="decimal"
        label={t.fields.ratePerKm}
        hint={t.fields.ratePerKmHint}
        defaultValue={valueOf("ratePerKm")}
        error={fieldError("ratePerKm", invalid)}
      />
    </div>
  );
}
