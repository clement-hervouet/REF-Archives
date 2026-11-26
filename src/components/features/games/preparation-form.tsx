"use client";

/**
 * Préparation d'un match (§15.4.10) : nombre d'équipes de la poule (commun aux deux
 * équipes), un bloc par équipe (position, victoires, défaites, notes sur les joueurs et les
 * coachs, case « déjà arbitrée cette saison ») et un bloc pour le trio arbitral
 * (cinq textes, case « observé »). Tout est facultatif, mais une préparation vide est
 * refusée côté serveur ; les cases arrivent pré-cochées par la page.
 *
 * Préparation partagée (`others`) : une case « déjà arbitrée » par arbitre ; seule celle de
 * l'utilisateur est modifiable, les autres sont affichées en lecture seule.
 *
 * Enregistrement champ par champ : chaque champ a son jumeau caché `base.…` (valeur de
 * départ). Si la préparation a été modifiée ailleurs entre-temps, rien n'est écrit ; le
 * formulaire garde alors la saisie des champs modifiés ici, reprend la version enregistrée
 * pour les autres (elle devient la valeur de départ) et signale les champs en conflit.
 */
import { useId } from "react";
import { RichTextField } from "@/components/features/common/rich-text-field";
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
  PREPARATION_FIELDS,
  PREPARATION_TEAMS,
  PREPARATION_TEXT_MAX,
  TEAM_COUNT_FIELD,
  TEAM_NUMBER_PARTS,
  TEAM_REFEREED_PART,
  baseFieldName,
  teamFieldName,
} from "@/lib/preparation-form-fields";
import type { PreparationTeam, TeamNumberPart } from "@/lib/preparation-form-fields";
import type { PreparationFormState } from "@/server/games/preparation-form";
import {
  preparationConflictText,
  preparationFieldError,
  preparationStatusMessage,
} from "./preparation-messages";

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
  /**
   * Préparation partagée : les autres arbitres du partage, avec leurs cases « déjà
   * arbitrée » (lecture seule). Vide ou absent : une seule case, celle de l'utilisateur.
   */
  others?: readonly SharedReferee[];
};

/** Autre arbitre d'une préparation partagée, et ses cases « déjà arbitrée ». */
type SharedReferee = {
  key: string;
  name: string;
  checks: Readonly<Record<PreparationTeam, boolean>>;
};

type FieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  error: string | null;
  /** Version enregistrée d'un champ modifié ailleurs entre-temps, ou `null`. */
  conflict: string | null;
};

/** Version enregistrée d'un champ modifié ailleurs entre-temps, sous le champ. */
function ConflictNote({ id, text }: { id: string; text: string | null }) {
  if (text === null) {
    return null;
  }
  return (
    <div id={id} className="rounded-md border border-warning bg-warning/15 px-3 py-2 text-sm">
      <p className="font-medium">{t.conflictLabel}</p>
      <p className="break-words whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function TextAreaField({ id, name, label, value, error, conflict }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <RichTextField
        id={id}
        name={name}
        label={label}
        defaultValue={value}
        maxLength={PREPARATION_TEXT_MAX}
        error={error}
      />
      <ConflictNote id={`${id}-conflict`} text={conflict} />
    </div>
  );
}

function NumberField({ id, name, label, value, error, conflict }: FieldProps) {
  const describedBy = [
    error !== null ? `${id}-error` : null,
    conflict !== null ? `${id}-conflict` : null,
  ].filter((entry) => entry !== null);
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
        aria-describedby={describedBy.length > 0 ? describedBy.join(" ") : undefined}
        className={`${FIELD_CLASS} tabular-nums`}
      />
      {error !== null && (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <ConflictNote id={`${id}-conflict`} text={conflict} />
    </div>
  );
}

type CheckboxProps = {
  id: string;
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  conflict: string | null;
};

function CheckboxField({ id, name, label, hint, checked, conflict }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          type="checkbox"
          name={name}
          value={CHECKBOX_ON}
          defaultChecked={checked}
          aria-describedby={conflict !== null ? `${id}-hint ${id}-conflict` : `${id}-hint`}
          className="h-5 w-5 shrink-0"
        />
        <span className="font-medium">{label}</span>
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
      <ConflictNote id={`${id}-conflict`} text={conflict} />
    </div>
  );
}

type RefereedProps = {
  id: string;
  name: string;
  team: PreparationTeam;
  checked: boolean;
  others: readonly SharedReferee[];
  conflict: string | null;
};

/**
 * « Déjà arbitrée cette saison » d'une préparation partagée : la case de l'utilisateur
 * (« Moi ») et, en lecture seule, celles des autres arbitres du partage.
 */
function SharedRefereedField({ id, name, team, checked, others, conflict }: RefereedProps) {
  const shared = fr.sharing;
  return (
    <fieldset className="flex flex-col gap-1" aria-describedby={`${id}-hint`}>
      <legend className="font-medium">{t.alreadyRefereed}</legend>
      <div className="flex flex-wrap gap-x-6">
        <label className="flex min-h-11 items-center gap-3">
          <input
            id={id}
            type="checkbox"
            name={name}
            value={CHECKBOX_ON}
            defaultChecked={checked}
            className="h-5 w-5 shrink-0"
          />
          <span>{shared.me}</span>
        </label>
        {others.map((other) => (
          <p key={other.key} className="flex min-h-11 items-center gap-3">
            {/* Case d'un autre arbitre : affichée, jamais envoyée (pas de `name`). */}
            <input
              type="checkbox"
              checked={other.checks[team]}
              disabled
              readOnly
              aria-label={(other.checks[team]
                ? shared.otherChecked
                : shared.otherUnchecked
              ).replace("{name}", other.name)}
              className="h-5 w-5 shrink-0"
            />
            <span aria-hidden="true">{other.name}</span>
          </p>
        ))}
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {shared.refereedHintShared}
      </p>
      <ConflictNote id={`${id}-conflict`} text={conflict} />
    </fieldset>
  );
}

export function PreparationForm({ action, gameId, teamNames, initialValues, others = [] }: Props) {
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
  const typed = (name: string): string => (keptInput ? valueOf(name) : (initialValues[name] ?? ""));
  const start = (name: string): string =>
    keptInput ? valueOf(baseFieldName(name)) : (initialValues[name] ?? "");
  const conflict = state.status === "conflict" ? state : null;
  // Après un conflit, la version enregistrée remplace les champs non modifiés ici et devient
  // la valeur de départ de tous : renvoyer le formulaire écrit alors la saisie restante.
  const current = (name: string): string =>
    conflict !== null && typed(name) === start(name) ? (conflict.saved[name] ?? "") : typed(name);
  const base = (name: string): string =>
    conflict !== null ? (conflict.saved[name] ?? "") : start(name);
  const field = (name: string, label: string): FieldProps => ({
    id: `${id}-${name}`,
    name,
    label,
    value: current(name),
    error: preparationFieldError(name, state),
    conflict: preparationConflictText(name, state),
  });

  return (
    <div className="flex flex-col gap-4">
      <form key={formKey} action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="gameId" value={gameId} />
        {PREPARATION_FIELDS.map((name) => (
          <input key={name} type="hidden" name={baseFieldName(name)} value={base(name)} />
        ))}
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
              {others.length > 0 ? (
                <SharedRefereedField
                  id={`${id}-${team}-refereed`}
                  name={teamFieldName(team, TEAM_REFEREED_PART)}
                  team={team}
                  checked={current(teamFieldName(team, TEAM_REFEREED_PART)) === CHECKBOX_ON}
                  others={others}
                  conflict={preparationConflictText(teamFieldName(team, TEAM_REFEREED_PART), state)}
                />
              ) : (
                <CheckboxField
                  id={`${id}-${team}-refereed`}
                  name={teamFieldName(team, TEAM_REFEREED_PART)}
                  label={t.alreadyRefereed}
                  hint={t.alreadyRefereedHint}
                  checked={current(teamFieldName(team, TEAM_REFEREED_PART)) === CHECKBOX_ON}
                  conflict={preparationConflictText(teamFieldName(team, TEAM_REFEREED_PART), state)}
                />
              )}
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
            conflict={preparationConflictText(OBSERVED_FIELD, state)}
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
