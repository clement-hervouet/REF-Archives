"use client";

/**
 * Préparation d'un match (§15.4.10) : nombre d'équipes de la poule (commun aux deux
 * équipes), un bloc par équipe (position, victoires, défaites, notes sur les joueurs et les
 * coachs, case « déjà arbitrée cette saison ») et un bloc pour le trio arbitral
 * (cinq textes, case « observé »). Tout est facultatif, mais une préparation vide est
 * refusée côté serveur ; les cases arrivent pré-cochées par la page.
 */
import { useId } from "react";
import {
  FIELD_CLASS,
  FormMessage,
  SUBMIT_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import {
  CHECKBOX_ON,
  CREW_FIELDS,
  OBSERVED_FIELD,
  PREPARATION_TEAMS,
  PREPARATION_TEXT_MAX,
  TEAM_COUNT_FIELD,
  TEAM_NUMBER_PARTS,
  TEAM_REFEREED_PART,
  teamFieldName,
} from "@/lib/preparation-form-fields";
import type { PreparationTeam, TeamNumberPart } from "@/lib/preparation-form-fields";
import type { PreparationFormState } from "@/server/games/preparation-form";
import { preparationFieldError, preparationStatusMessage } from "./preparation-messages";

const t = fr.preparations.form;

const NUMBER_LABELS: Record<TeamNumberPart, string> = {
  Rank: t.rank,
  Wins: t.wins,
  Losses: t.losses,
};

type Props = {
  action: (previous: PreparationFormState, formData: FormData) => Promise<PreparationFormState>;
  gameId: string;
  /** Noms des clubs des deux équipes, titres des blocs. */
  teamNames: Readonly<Record<PreparationTeam, string>>;
  /** Préparation enregistrée (ou valeurs pré-cochées), relue après chaque enregistrement. */
  initialValues: Readonly<Record<string, string>>;
};

type FieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  error: string | null;
};

function TextAreaField({ id, name, label, value, error }: FieldProps) {
  const describedBy = `${id}-hint${error !== null ? ` ${id}-error` : ""}`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={4}
        maxLength={PREPARATION_TEXT_MAX}
        defaultValue={value}
        aria-invalid={error !== null}
        aria-describedby={describedBy}
        className={FIELD_CLASS}
      />
      <p id={`${id}-hint`} className="sr-only">
        {t.textHint}
      </p>
      {error !== null && (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NumberField({ id, name, label, value, error }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        defaultValue={value}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? `${id}-error` : undefined}
        className={`${FIELD_CLASS} tabular-nums`}
      />
      {error !== null && (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type CheckboxProps = { id: string; name: string; label: string; hint: string; checked: boolean };

function CheckboxField({ id, name, label, hint, checked }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          type="checkbox"
          name={name}
          value={CHECKBOX_ON}
          defaultChecked={checked}
          aria-describedby={`${id}-hint`}
          className="h-5 w-5 shrink-0"
        />
        <span className="font-medium">{label}</span>
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

export function PreparationForm({ action, gameId, teamNames, initialValues }: Props) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["saved"],
    initialValues,
  );
  // Comme NoteForm : sans saisie conservée (premier affichage, succès), on repart des
  // valeurs enregistrées.
  const keptInput = valueOf("gameId") !== "";
  const current = (name: string): string =>
    keptInput ? valueOf(name) : (initialValues[name] ?? "");
  const field = (name: string, label: string): FieldProps => ({
    id: `${id}-${name}`,
    name,
    label,
    value: current(name),
    error: preparationFieldError(name, state),
  });

  return (
    <div className="flex flex-col gap-4">
      <form key={formKey} action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="gameId" value={gameId} />
        {/* Les deux équipes sont dans la même poule : un seul nombre d'équipes. */}
        <div className="max-w-xs">
          <NumberField {...field(TEAM_COUNT_FIELD, t.teamCount)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {PREPARATION_TEAMS.map((team) => (
            <fieldset
              key={team}
              className="flex min-w-0 flex-col gap-4 rounded-md border border-border p-4"
            >
              <legend className="px-1 text-lg font-semibold break-words">{teamNames[team]}</legend>
              <div className="grid grid-cols-3 gap-3">
                {TEAM_NUMBER_PARTS.map((part) => (
                  <NumberField
                    key={part}
                    {...field(teamFieldName(team, part), NUMBER_LABELS[part])}
                  />
                ))}
              </div>
              <CheckboxField
                id={`${id}-${team}-refereed`}
                name={teamFieldName(team, TEAM_REFEREED_PART)}
                label={t.alreadyRefereed}
                hint={t.alreadyRefereedHint}
                checked={current(teamFieldName(team, TEAM_REFEREED_PART)) === CHECKBOX_ON}
              />
              <TextAreaField {...field(teamFieldName(team, "Players"), t.players)} />
              <TextAreaField {...field(teamFieldName(team, "Coaches"), t.coaches)} />
            </fieldset>
          ))}
        </div>
        <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-border p-4">
          <legend className="px-1 text-lg font-semibold">{t.crewLegend}</legend>
          <CheckboxField
            id={`${id}-observed`}
            name={OBSERVED_FIELD}
            label={t.observed}
            hint={t.observedHint}
            checked={current(OBSERVED_FIELD) === CHECKBOX_ON}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {CREW_FIELDS.map((name) => (
              <TextAreaField key={name} {...field(name, t.crew[name])} />
            ))}
          </div>
        </fieldset>
        {/* Formulaire long : le résultat s'affiche près du bouton, là où l'on vient de cliquer. */}
        <FormMessage message={preparationStatusMessage(state)} />
        <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
          {isPending ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
