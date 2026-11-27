/**
 * Choix du club d'une équipe : un club existant, ou « Nouveau club… » (création à la volée,
 * bloc 6) : recherche dans l'annuaire FFBB par ville, qui remplit nom et adresse de la
 * salle, ou à défaut nom et code postal saisis (le reste de l'adresse se complète dans
 * l'onglet « Clubs », §15.4.1 ; le code postal suffit à déduire l'organisme).
 */
import { NewClubFields } from "@/components/features/clubs/new-club-fields";
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
  /** Nouveau club choisi ou saisi : le formulaire relit ses champs (récapitulatif). */
  onNewClubChange?: (() => void) | undefined;
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
  onNewClubChange,
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
        <NewClubFields
          idBase={idBase}
          names={{
            name: `${prefix}Name`,
            postalCode: `${prefix}PostalCode`,
            street: `${prefix}Street`,
            number: `${prefix}Number`,
            city: `${prefix}City`,
            venue: `${prefix}Venue`,
            venues: `${prefix}Venues`,
            ffbb: `${prefix}Ffbb`,
          }}
          labels={{
            name: t.fields.clubName,
            postalCode: t.fields.postalCode,
            postalCodeHint: t.fields.newClubPostalCodeHint,
          }}
          valueOf={valueOf}
          errors={{
            name: fieldError(`${prefix}.name`, state),
            postalCode: fieldError(`${prefix}.postalCode`, state),
          }}
          onResolved={onNewClubChange}
        />
      )}
    </fieldset>
  );
}
