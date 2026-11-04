"use client";

/**
 * Formulaire « Nouvelle indemnité » (bloc 6). Les listes (niveau, barème, clubs, adresse)
 * sont contrôlées pour afficher les champs de création à la volée et présélectionner le
 * barème du niveau ; les champs texte restent non contrôlés (`defaultValue`).
 */
import { useId, useState } from "react";
import { divisionLabel } from "@/components/features/scales/division-label";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { NEW_CHOICE } from "@/lib/compensation-form-fields";
import type { CreateCompensationState } from "@/server/compensation/compensation-form";
import type { AddressSummary, ClubSummary } from "@/server/db/clubs";
import type { Division } from "@/server/db/divisions";
import { AddressFields } from "./address-fields";
import { addressLabel } from "./address-label";
import { ClubFields } from "./club-fields";
import { compensationStatusMessage, fieldError } from "./compensation-messages";
import { SelectField } from "./select-field";

const t = fr.compensations;

type Action = (
  previous: CreateCompensationState,
  formData: FormData,
) => Promise<CreateCompensationState>;

export type CompensationFormData = {
  divisions: readonly Division[];
  /** Barèmes choisissables : le commun en premier, puis ceux de l'utilisateur. */
  scales: readonly { id: string; name: string }[];
  /** Barème présélectionné pour chaque niveau (choix de l'utilisateur, sinon le commun). */
  defaultScaleByDivision: Readonly<Record<string, string>>;
  clubs: readonly ClubSummary[];
  addresses: readonly AddressSummary[];
};

type Props = CompensationFormData & { action: Action };

export function CompensationForm({ action, ...data }: Props) {
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["created"],
  );

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={compensationStatusMessage(state)} />
      {/* Remonté après chaque envoi : les listes repartent de la saisie conservée. */}
      <form key={formKey} action={formAction} className="flex flex-col gap-6">
        <Fields data={data} state={state} valueOf={valueOf} />
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? t.new.submitting : t.new.submit}
        </button>
      </form>
    </div>
  );
}

type FieldsProps = {
  data: CompensationFormData;
  state: CreateCompensationState;
  valueOf: (name: string) => string;
};

/** Niveaux regroupés par catégorie (Départemental, Régional…), dans l'ordre reçu. */
function groupByCategory(divisions: readonly Division[]): [Division["category"], Division[]][] {
  const groups = new Map<Division["category"], Division[]>();
  for (const division of divisions) {
    const group = groups.get(division.category) ?? [];
    group.push(division);
    groups.set(division.category, group);
  }
  return [...groups.entries()];
}

function Fields({ data, state, valueOf }: FieldsProps) {
  const id = useId();
  const [divisionId, setDivisionId] = useState(valueOf("divisionId"));
  const [scaleId, setScaleId] = useState(
    valueOf("scaleId") || (data.defaultScaleByDivision[valueOf("divisionId")] ?? ""),
  );
  const [team1Club, setTeam1Club] = useState(valueOf("team1Club"));
  const [team2Club, setTeam2Club] = useState(valueOf("team2Club"));
  const [venueException, setVenueException] = useState(valueOf("venueException") === "on");
  const [venueAddress, setVenueAddress] = useState(valueOf("venueAddress"));

  const club1 = data.clubs.find((club) => club.id === team1Club);
  const venueHintId = `${id}-venue-default`;

  return (
    <>
      <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-neutral-300 p-4">
        <legend className="px-1 font-semibold">{t.sections.match}</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id={`${id}-date`}
            name="date"
            type="date"
            label={t.fields.date}
            defaultValue={valueOf("date")}
            error={fieldError("date", state)}
          />
          <TextField
            id={`${id}-time`}
            name="time"
            type="time"
            label={t.fields.time}
            defaultValue={valueOf("time")}
            error={fieldError("time", state)}
          />
          <SelectField
            id={`${id}-division`}
            name="divisionId"
            label={t.fields.division}
            value={divisionId}
            onChange={(value) => {
              setDivisionId(value);
              // Changer de niveau repropose son barème par défaut.
              setScaleId(data.defaultScaleByDivision[value] ?? "");
            }}
            error={fieldError("divisionId", state)}
          >
            <option value="">{t.fields.chooseDivision}</option>
            {groupByCategory(data.divisions).map(([category, divisions]) => (
              <optgroup key={category} label={fr.scales.divisions.category[category]}>
                {divisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {divisionLabel(division)}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <SelectField
            id={`${id}-scale`}
            name="scaleId"
            label={t.fields.scale}
            hint={t.fields.scaleHint}
            value={scaleId}
            onChange={setScaleId}
            error={fieldError("scaleId", state)}
          >
            <option value="" disabled>
              {t.fields.scale}
            </option>
            {data.scales.map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <div className="grid gap-6 lg:grid-cols-2">
        <ClubFields
          idBase={`${id}-team1`}
          prefix="team1"
          legend={t.sections.team1}
          clubs={data.clubs}
          value={team1Club}
          onChange={setTeam1Club}
          valueOf={valueOf}
          state={state}
        />
        <ClubFields
          idBase={`${id}-team2`}
          prefix="team2"
          legend={t.sections.team2}
          clubs={data.clubs}
          value={team2Club}
          onChange={setTeam2Club}
          valueOf={valueOf}
          state={state}
        />
      </div>

      <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-neutral-300 p-4">
        <legend className="px-1 font-semibold">{t.sections.venue}</legend>
        {!venueException && (club1 !== undefined || team1Club === NEW_CHOICE) && (
          <p id={venueHintId} className="text-sm text-neutral-700">
            {club1 !== undefined
              ? t.fields.defaultVenue.replace("{address}", addressLabel(club1.address))
              : t.fields.defaultVenueNewClub}
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="venueException"
            checked={venueException}
            onChange={(event) => {
              setVenueException(event.target.checked);
            }}
            className="h-5 w-5 shrink-0"
          />
          <span>{t.fields.venueException}</span>
        </label>
        {venueException && (
          <>
            <SelectField
              id={`${id}-venue`}
              name="venueAddress"
              label={t.fields.venueAddress}
              value={venueAddress}
              onChange={setVenueAddress}
              error={fieldError("venue", state)}
            >
              <option value="">{t.fields.chooseAddress}</option>
              {data.addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {addressLabel(address)}
                </option>
              ))}
              <option value={NEW_CHOICE}>{t.fields.newAddress}</option>
            </SelectField>
            {venueAddress === NEW_CHOICE && (
              <AddressFields
                idBase={`${id}-venue`}
                prefix="venue"
                valueOf={valueOf}
                state={state}
              />
            )}
          </>
        )}
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-neutral-300 p-4">
        <legend className="px-1 font-semibold">{t.sections.travel}</legend>
        <div className="md:max-w-xs">
          <TextField
            id={`${id}-distance`}
            name="oneWayDistance"
            inputMode="decimal"
            label={t.fields.distance}
            hint={t.fields.distanceHint}
            maxLength={9}
            defaultValue={valueOf("oneWayDistance")}
            error={fieldError("oneWayDistance", state)}
          />
        </div>
      </fieldset>
    </>
  );
}
