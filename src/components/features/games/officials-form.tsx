"use client";

/**
 * Formulaire des officiels (bloc 9) : arbitres 1 à 3 dans l'ordre officiel et
 * observateur. Chaque place propose « Moi », un collègue connu ou un nouveau collègue
 * (fiche nom seul, créée à l'enregistrement). Sert à la création du match depuis une
 * indemnité comme à la modification des officiels.
 */
import { useId, useState } from "react";
import { SelectField } from "@/components/features/compensations/select-field";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import {
  OFFICIAL_SLOTS,
  PERSON_NAME_MAX,
  PERSON_NEW,
  PERSON_NONE,
  PERSON_SELF,
  officialFieldName,
} from "@/lib/game-form-fields";
import type { OfficialSlot } from "@/lib/game-form-fields";
import type { Colleague } from "@/server/db/persons";
import type { OfficialsFormState } from "@/server/games/officials-form";
import { officialsStatusMessage, slotError } from "./game-messages";
import { personLabel } from "./person-label";

const t = fr.games;

type Props = {
  action: (previous: OfficialsFormState, formData: FormData) => Promise<OfficialsFormState>;
  colleagues: readonly Colleague[];
  /** Valeurs enregistrées (ou proposées), relues après chaque enregistrement réussi. */
  initialValues: Readonly<Record<string, string>>;
  /** Champ caché vérifié côté serveur : `compensationId` (création) ou `gameId`. */
  hidden: { name: "compensationId" | "gameId"; value: string };
  labels: { submit: string; submitting: string };
};

export function OfficialsForm({ action, colleagues, initialValues, hidden, labels }: Props) {
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["updated"],
    initialValues,
  );
  // Après un succès, la saisie est oubliée : on repart des valeurs enregistrées, que la
  // page renvoie à jour (un nouveau collègue y apparaît avec son identifiant). Le champ
  // caché, toujours envoyé, distingue « saisie conservée » de « rien de conservé ».
  const keptInput = valueOf(hidden.name) !== "";
  const current = (name: string): string =>
    keptInput ? valueOf(name) : (initialValues[name] ?? "");

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={officialsStatusMessage(state)} />
      <form key={formKey} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name={hidden.name} value={hidden.value} />
        <fieldset className="flex min-w-0 flex-col gap-4 rounded-md border border-neutral-300 p-4">
          <legend className="px-1 font-semibold">{t.officials.legend}</legend>
          <p className="text-sm text-neutral-700">{t.officials.intro}</p>
          <div className="grid gap-6 md:grid-cols-2">
            {OFFICIAL_SLOTS.map((slot) => (
              <SlotFields
                key={slot}
                slot={slot}
                colleagues={colleagues}
                current={current}
                error={slotError(slot, state)}
              />
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? labels.submitting : labels.submit}
        </button>
      </form>
    </div>
  );
}

type SlotFieldsProps = {
  slot: OfficialSlot;
  colleagues: readonly Colleague[];
  current: (name: string) => string;
  error: string | null;
};

function SlotFields({ slot, colleagues, current, error }: SlotFieldsProps) {
  const id = useId();
  const personName = officialFieldName(slot, "Person");
  // L'arbitre 1 est obligatoire : pas de choix « Personne ».
  const allowNone = slot !== "referee1";
  const [person, setPerson] = useState(current(personName) || (allowNone ? PERSON_NONE : ""));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SelectField
        id={`${id}-person`}
        name={personName}
        label={t.slots[slot]}
        value={person}
        onChange={setPerson}
        error={error}
      >
        {allowNone ? (
          <option value={PERSON_NONE}>{t.officials.none}</option>
        ) : (
          <option value="" disabled>
            {t.slots[slot]}
          </option>
        )}
        <option value={PERSON_SELF}>{t.officials.self}</option>
        {colleagues.length > 0 && (
          <optgroup label={t.officials.chooseColleague}>
            {colleagues.map((colleague) => (
              <option key={colleague.id} value={colleague.id}>
                {personLabel(colleague)}
              </option>
            ))}
          </optgroup>
        )}
        <option value={PERSON_NEW}>{t.officials.newColleague}</option>
      </SelectField>
      {person === PERSON_NEW && (
        <div className="flex flex-col gap-3 border-l-2 border-neutral-300 pl-3">
          <TextField
            id={`${id}-lastname`}
            name={officialFieldName(slot, "Lastname")}
            label={t.officials.lastname}
            maxLength={PERSON_NAME_MAX}
            defaultValue={current(officialFieldName(slot, "Lastname"))}
            error={null}
          />
          <TextField
            id={`${id}-firstname`}
            name={officialFieldName(slot, "Firstname")}
            label={t.officials.firstname}
            maxLength={PERSON_NAME_MAX}
            required={false}
            defaultValue={current(officialFieldName(slot, "Firstname"))}
            error={null}
          />
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              name={officialFieldName(slot, "HasAccount")}
              defaultChecked={current(officialFieldName(slot, "HasAccount")) === "on"}
              aria-describedby={`${id}-has-account-hint`}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span className="flex flex-col">
              <span>{t.officials.hasAccount}</span>
              <span id={`${id}-has-account-hint`} className="text-sm text-neutral-700">
                {t.officials.hasAccountHint}
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
