/**
 * Champs d'une nouvelle adresse (club ou salle). Les noms suivent `compensation-form.ts` :
 * `team1Street`, `venueCity`… ; les erreurs, `team1.street`, `venue.city`…
 */
import { TextField } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { CreateCompensationState } from "@/server/compensation/compensation-form";
import { fieldError } from "./compensation-messages";

const t = fr.compensations.fields;

type Props = {
  idBase: string;
  prefix: "team1" | "team2" | "venue";
  valueOf: (name: string) => string;
  state: CreateCompensationState;
};

export function AddressFields({ idBase, prefix, valueOf, state }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
      <TextField
        id={`${idBase}-street`}
        name={`${prefix}Street`}
        label={t.street}
        maxLength={255}
        defaultValue={valueOf(`${prefix}Street`)}
        error={fieldError(`${prefix}.street`, state)}
      />
      <TextField
        id={`${idBase}-number`}
        name={`${prefix}Number`}
        label={t.number}
        maxLength={20}
        required={false}
        defaultValue={valueOf(`${prefix}Number`)}
        error={fieldError(`${prefix}.number`, state)}
      />
      <div className="grid gap-4 md:col-span-2 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,12rem)]">
        <TextField
          id={`${idBase}-postal-code`}
          name={`${prefix}PostalCode`}
          label={t.postalCode}
          maxLength={10}
          defaultValue={valueOf(`${prefix}PostalCode`)}
          error={fieldError(`${prefix}.postalCode`, state)}
        />
        <TextField
          id={`${idBase}-city`}
          name={`${prefix}City`}
          label={t.city}
          maxLength={255}
          defaultValue={valueOf(`${prefix}City`)}
          error={fieldError(`${prefix}.city`, state)}
        />
        <TextField
          id={`${idBase}-country`}
          name={`${prefix}Country`}
          label={t.country}
          maxLength={100}
          required={false}
          defaultValue={valueOf(`${prefix}Country`)}
          error={fieldError(`${prefix}.country`, state)}
        />
      </div>
    </div>
  );
}
