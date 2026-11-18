/**
 * Choix du club d'une équipe : un club existant, ou « Nouveau club… » qui fait apparaître
 * son nom et son code postal (création à la volée, bloc 6). Le reste de l'adresse se
 * complète dans l'onglet « Clubs » (§15.4.1) ; le code postal suffit à déduire l'organisme.
 */
import { TextField } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { NEW_CHOICE } from "@/lib/compensation-form-fields";
import type { CompensationFormState } from "@/server/compensation/compensation-form";
import type { ClubSummary } from "@/server/db/clubs";
import { clubPlace } from "./address-label";
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
  state: CompensationFormState;
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
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-border p-4">
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
            {club.name} ({clubPlace(club.address)})
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
            uppercase
            defaultValue={valueOf(`${prefix}Name`)}
            error={fieldError(`${prefix}.name`, state)}
          />
          <div className="md:max-w-xs">
            <TextField
              id={`${idBase}-postal-code`}
              name={`${prefix}PostalCode`}
              label={t.fields.postalCode}
              hint={t.fields.newClubPostalCodeHint}
              maxLength={10}
              defaultValue={valueOf(`${prefix}PostalCode`)}
              error={fieldError(`${prefix}.postalCode`, state)}
            />
          </div>
        </>
      )}
    </fieldset>
  );
}
