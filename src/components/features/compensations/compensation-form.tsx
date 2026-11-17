"use client";

/**
 * Formulaire d'indemnité (bloc 6), pour la saisie comme pour la modification. Ses champs
 * de match (`MatchFields`) servent aussi au match complet sans indemnité (bloc 9e). Les listes (niveau, barème, clubs, adresse)
 * sont contrôlées pour afficher les champs de création à la volée et présélectionner le
 * barème du niveau ; les champs texte restent non contrôlés (`defaultValue`).
 */
import { useId, useState } from "react";
import { RevealResult } from "@/components/features/common/reveal-result";
import {
  divisionAbbreviation,
  divisionLabel,
  groupDivisions,
} from "@/components/features/scales/division-label";
import {
  FormMessage,
  SUBMIT_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import { NEW_CHOICE } from "@/lib/compensation-form-fields";
import type { CompensationFormState } from "@/server/compensation/compensation-form";
import type { CompensationFormData } from "@/server/compensation/form-data";
import { CUP_ROUNDS } from "@/server/db/divisions";
import type { Division } from "@/server/db/divisions";
import { AddressFields } from "./address-fields";
import { addressLabel } from "./address-label";
import { ClubFields } from "./club-fields";
import { previewCompensation } from "@/server/compensation/preview";
import { compensationStatusMessage, fieldError } from "./compensation-messages";
import { CompensationRecap } from "./compensation-recap";
import { PayerSelect } from "./payer-select";
import { SeasonStartCelebration } from "./season-start-celebration";
import {
  hasSameDayMatch,
  matchDepartment,
  previewInputFromForm,
  readFormData,
} from "./preview-input";
import { SelectField } from "./select-field";

const t = fr.compensations;

type Action = (
  previous: CompensationFormState,
  formData: FormData,
) => Promise<CompensationFormState>;

type Props = CompensationFormData & {
  action: Action;
  /**
   * Modification d'une indemnité existante : valeurs de départ, dont l'identifiant
   * (`compensationId`, champ caché vérifié côté serveur). Sans elles : saisie.
   */
  initialValues?: Readonly<Record<string, string>>;
};

export function CompensationForm({ action, initialValues, ...data }: Props) {
  const editing = initialValues !== undefined;
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    // Après une saisie réussie, le formulaire se vide ; après une modification, il garde
    // les valeurs enregistrées.
    editing ? [] : ["created"],
    initialValues,
  );
  const labels = editing ? t.edit : t.new;
  const compensationId = valueOf("compensationId");

  // Récapitulatif en direct (bloc 10) : relu dans le formulaire à chaque saisie. Lié au
  // `formKey` : après un envoi (formulaire remonté), il repart des valeurs conservées.
  const [snapshot, setSnapshot] = useState<{ key: number; read: (name: string) => string }>({
    key: formKey,
    read: valueOf,
  });
  const read = snapshot.key === formKey ? snapshot.read : valueOf;
  const recapInput = previewInputFromForm(read, data);
  const recapPreview = previewCompensation(recapInput);

  return (
    <RevealResult submission={formKey} className="flex flex-col gap-4">
      <FormMessage message={compensationStatusMessage(state)} />
      {/* Première indemnité d'une saison FFBB (bloc 12d) : une salve par saisie (clé). */}
      {state.status === "created" && state.firstOfSeason !== null && (
        <SeasonStartCelebration key={formKey} season={state.firstOfSeason} />
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Remonté après chaque envoi : les listes repartent de la saisie conservée. */}
        <form
          key={formKey}
          action={formAction}
          onChange={(event) => {
            const form = event.currentTarget;
            // Lu au tour suivant : un changement de niveau repositionne le barème par
            // l'état de React, appliqué au DOM après ce gestionnaire.
            window.setTimeout(() => {
              if (form.isConnected) {
                setSnapshot({ key: formKey, read: readFormData(new FormData(form)) });
              }
            }, 0);
          }}
          className="flex min-w-0 flex-col gap-6"
        >
          {editing && <input type="hidden" name="compensationId" value={compensationId} />}
          <MatchFields data={data} state={state} valueOf={valueOf} liveRead={read} />
          {/* Téléphone : le récapitulatif juste avant le bouton. Ordinateur : à côté. */}
          <CompensationRecap input={recapInput} preview={recapPreview} className="lg:hidden" />
          <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
            {isPending ? labels.submitting : labels.submit}
          </button>
        </form>
        <CompensationRecap
          input={recapInput}
          preview={recapPreview}
          className="hidden lg:sticky lg:top-6 lg:flex"
        />
      </div>
    </RevealResult>
  );
}

type FieldsProps = {
  data: CompensationFormData;
  state: CompensationFormState;
  valueOf: (name: string) => string;
  /** Faux pour un match complet sans indemnité : ni barème ni déplacement. */
  withCompensation?: boolean;
  /** Valeurs en cours de saisie (récapitulatif) : repèrent un doublé (§15.4.5). */
  liveRead?: (name: string) => string;
};

/**
 * Niveaux souvent arbitrés, dans l'ordre de fréquence. Ils restent aussi dans leur catégorie :
 * la liste complète garde le même ordre d'une saisie à l'autre.
 */
function frequentDivisions(
  divisions: readonly Division[],
  frequentIds: readonly string[],
): Division[] {
  const byId = new Map(divisions.map((division) => [division.id, division]));
  return frequentIds.flatMap((divisionId) => byId.get(divisionId) ?? []);
}

/** Champs d'un match (date, niveau, équipes, adresse), plus barème et distance pour une indemnité. */
export function MatchFields({
  data,
  state,
  valueOf,
  withCompensation = true,
  liveRead = valueOf,
}: FieldsProps) {
  const id = useId();
  const [divisionId, setDivisionId] = useState(valueOf("divisionId"));
  const [scaleId, setScaleId] = useState(
    valueOf("scaleId") || (data.defaultScaleByDivision[valueOf("divisionId")] ?? ""),
  );
  const [cupRound, setCupRound] = useState(valueOf("cupRound"));
  const [team1Club, setTeam1Club] = useState(valueOf("team1Club"));
  const [team2Club, setTeam2Club] = useState(valueOf("team2Club"));
  const [venueException, setVenueException] = useState(valueOf("venueException") === "on");
  const [venueAddress, setVenueAddress] = useState(valueOf("venueAddress"));
  // Doublé (§15.4.5) : `null` = automatique, la case suit la détection (saisie seulement).
  // En modification, ou dès que la case a été touchée, elle garde le choix fait.
  const [travelShared, setTravelShared] = useState<boolean | null>(
    valueOf("compensationId") !== "" || valueOf("travelSharedSet") === "1"
      ? valueOf("travelShared") === "on"
      : null,
  );
  const sameDayMatch = withCompensation && hasSameDayMatch(liveRead, data);
  const travelSharedChecked = travelShared ?? sameDayMatch;

  const club1 = data.clubs.find((club) => club.id === team1Club);
  const frequent = frequentDivisions(data.divisions, data.frequentDivisionIds);
  // Coupes (§15.4.6) : le tour n'est demandé que pour un niveau de coupe, et le nom de la
  // coupe suit le département du match (listes contrôlées ici, codes postaux saisis lus en
  // direct).
  const isCup = data.divisions.some((division) => division.id === divisionId && division.cup);
  const department = matchDepartment((name) => {
    switch (name) {
      case "team1Club":
        return team1Club;
      case "venueException":
        return venueException ? "on" : "";
      case "venueAddress":
        return venueAddress;
      default:
        return liveRead(name);
    }
  }, data);
  const divisionOption = (division: Division) => (
    <option key={division.id} value={division.id} title={divisionLabel(division)}>
      {divisionAbbreviation(division, department)}
    </option>
  );
  const venueHintId = `${id}-venue-default`;
  const travelHintId = `${id}-travel-shared-hint`;

  return (
    <>
      <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-border p-4">
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
            {frequent.length > 0 && (
              <optgroup label={t.fields.frequentDivisions}>{frequent.map(divisionOption)}</optgroup>
            )}
            {/* Championnats par catégorie, puis les coupes en bas de la liste. */}
            {groupDivisions(data.divisions).map((group) => (
              <optgroup key={group.key} label={group.label}>
                {group.divisions.map(divisionOption)}
              </optgroup>
            ))}
          </SelectField>
          {isCup && (
            <SelectField
              id={`${id}-cup-round`}
              name="cupRound"
              label={t.fields.cupRound}
              value={cupRound}
              onChange={setCupRound}
              error={fieldError("cupRound", state)}
            >
              <option value="">{t.fields.chooseCupRound}</option>
              {CUP_ROUNDS.map((round) => (
                <option key={round} value={round}>
                  {fr.scales.divisions.cup.round[round]}
                </option>
              ))}
            </SelectField>
          )}
          {withCompensation && (
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
          )}
          {withCompensation && (
            <div className="md:col-span-2">
              <PayerSelect
                id={`${id}-payer`}
                defaultValue={valueOf("payer")}
                error={fieldError("payer", state)}
              />
            </div>
          )}
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

      <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 font-semibold">{t.sections.venue}</legend>
        {!venueException && (club1 !== undefined || team1Club === NEW_CHOICE) && (
          <p id={venueHintId} className="text-sm text-muted-foreground">
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

      {withCompensation && (
        <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-border p-4">
          <legend className="px-1 font-semibold">{t.sections.travel}</legend>
          {/* Choix explicite : conservé si le formulaire revient avec une erreur. */}
          {travelShared !== null && <input type="hidden" name="travelSharedSet" value="1" />}
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name="travelShared"
                checked={travelSharedChecked}
                onChange={(event) => {
                  setTravelShared(event.target.checked);
                }}
                aria-describedby={travelHintId}
                className="h-5 w-5 shrink-0"
              />
              <span>{t.fields.travelShared}</span>
            </label>
            <p id={travelHintId} className="text-sm text-muted-foreground">
              {sameDayMatch && (
                <span className="font-medium text-foreground">
                  {t.fields.travelSharedDetected}{" "}
                </span>
              )}
              {t.fields.travelSharedHint}
            </p>
          </div>
          <div className="md:max-w-xs">
            {/* Doublé : distance facultative (vide = 0), le kilométrage vaut 0 de toute façon. */}
            <TextField
              id={`${id}-distance`}
              name="oneWayDistance"
              inputMode="decimal"
              label={travelSharedChecked ? t.fields.distanceOptional : t.fields.distance}
              hint={t.fields.distanceHint}
              maxLength={9}
              required={!travelSharedChecked}
              defaultValue={valueOf("oneWayDistance")}
              error={fieldError("oneWayDistance", state)}
            />
          </div>
        </fieldset>
      )}
    </>
  );
}
