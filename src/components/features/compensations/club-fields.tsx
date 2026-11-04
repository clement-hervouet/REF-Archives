/**
 * Choix du club d'une équipe : un club existant, ou « Nouveau club… » qui fait apparaître
 * son nom et son adresse (création à la volée, bloc 6).
 */
import { TextField } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { NEW_CHOICE } from "@/lib/compensation-form-fields";
import type { CreateCompensationState } from "@/server/compensation/compensation-form";
import type { ClubSummary } from "@/server/db/clubs";
import { AddressFields } from "./address-fields";
import { fieldError } from "./compensation-messages";
import { SelectField } from "./select-field";

const t = fr.compensations;

type Props = {
  idBase: string;
  prefix: "team1" | "team2";
  legend: string;
  clubs: readonly ClubSummary[];
  value: string;
  onChange: (value: string) => void;
  valueOf: (name: string) => string;
  state: CreateCompensationState;
};

export function ClubFields({
  idBase,
  prefix,
  legend,
  clubs,
  value,
  onChange,
  valueOf,
  state,
}: Props) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-neutral-300 p-4">
      <legend className="px-1 font-semibold">{legend}</legend>
      <SelectField
        id={`${idBase}-club`}
        name={`${prefix}Club`}
        label={t.fields.club}
        value={value}
        onChange={onChange}
        error={fieldError(prefix, state)}
      >
        <option value="">{t.fields.chooseClub}</option>
        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name} ({club.address.city})
          </option>
        ))}
        <option value={NEW_CHOICE}>{t.fields.newClub}</option>
      </SelectField>
      {value === NEW_CHOICE && (
        <>
          <TextField
            id={`${idBase}-name`}
            name={`${prefix}Name`}
            label={t.fields.clubName}
            maxLength={255}
            defaultValue={valueOf(`${prefix}Name`)}
            error={fieldError(`${prefix}.name`, state)}
          />
          <AddressFields idBase={idBase} prefix={prefix} valueOf={valueOf} state={state} />
        </>
      )}
    </fieldset>
  );
}
