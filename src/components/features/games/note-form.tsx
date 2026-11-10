"use client";

/**
 * Note d'un match (blocs 9 et 10) : confiance, stress, gestion du match et jugement de 1 à
 * 5 (boutons radio, « non renseigné » possible), texte libre et liens de clips, un par
 * ligne. Tout est facultatif, mais une note vide est refusée côté serveur.
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
  CLIP_URL_MAX,
  MAX_CLIPS_PER_NOTE,
  NOTE_BODY_MAX,
  NOTE_LEVEL_FIELDS,
  NOTE_LEVELS,
} from "@/lib/game-form-fields";
import type { NoteLevelField } from "@/lib/game-form-fields";
import type { NoteFormState } from "@/server/games/note-form";
import { noteFieldError, noteStatusMessage } from "./game-messages";
import { levelTone } from "./level-tone";
import type { LevelTone } from "./level-tone";

const t = fr.games.note;

type Props = {
  action: (previous: NoteFormState, formData: FormData) => Promise<NoteFormState>;
  gameId: string;
  /** Note enregistrée, relue après chaque enregistrement réussi. */
  initialValues: Readonly<Record<string, string>>;
};

export function NoteForm({ action, gameId, initialValues }: Props) {
  const id = useId();
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    ["saved"],
    initialValues,
  );
  // Voir OfficialsForm : sans saisie conservée, on repart de la note enregistrée.
  const keptInput = valueOf("gameId") !== "";
  const current = (name: string): string =>
    keptInput ? valueOf(name) : (initialValues[name] ?? "");
  const bodyError = noteFieldError("body", state);
  const clipsError = noteFieldError("clips", state);

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={noteStatusMessage(state)} />
      <form key={formKey} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="gameId" value={gameId} />
        <div className="grid gap-4 md:grid-cols-2">
          {NOTE_LEVEL_FIELDS.map((field) => (
            <LevelField
              key={field}
              idBase={`${id}-${field}`}
              name={field}
              legend={t.levels[field]}
              value={current(field)}
              error={noteFieldError(field, state)}
            />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-body`} className="text-sm font-medium">
            {t.body}
          </label>
          <textarea
            id={`${id}-body`}
            name="body"
            rows={6}
            maxLength={NOTE_BODY_MAX}
            defaultValue={current("body")}
            aria-invalid={bodyError !== null}
            aria-describedby={`${id}-body-hint${bodyError !== null ? ` ${id}-body-error` : ""}`}
            className={FIELD_CLASS}
          />
          <p id={`${id}-body-hint`} className="text-sm text-muted-foreground">
            {t.bodyHint}
          </p>
          {bodyError !== null && (
            <p id={`${id}-body-error`} className="text-sm font-medium text-destructive">
              {bodyError}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-clips`} className="text-sm font-medium">
            {t.clips}
          </label>
          <textarea
            id={`${id}-clips`}
            name="clips"
            rows={4}
            // Garde-fou du navigateur seulement : le serveur revalide tout.
            maxLength={MAX_CLIPS_PER_NOTE * (CLIP_URL_MAX + 1)}
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            defaultValue={current("clips")}
            aria-invalid={clipsError !== null}
            aria-describedby={`${id}-clips-hint${clipsError !== null ? ` ${id}-clips-error` : ""}`}
            className={`${FIELD_CLASS} font-mono text-sm`}
          />
          <p id={`${id}-clips-hint`} className="text-sm text-muted-foreground">
            {t.clipsHint}
          </p>
          {clipsError !== null && (
            <p id={`${id}-clips-error`} className="text-sm font-medium text-destructive">
              {clipsError}
            </p>
          )}
        </div>
        <button type="submit" disabled={isPending} className={SUBMIT_BUTTON_CLASS}>
          {isPending ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}

type LevelFieldProps = {
  idBase: string;
  name: NoteLevelField;
  legend: string;
  value: string;
  error: string | null;
};

/**
 * Option cochée : bordure et fond teinté dans la couleur du ton (bloc 10), texte en couleur
 * normale (le vert et le jaune ne portent pas de texte, §3.12). Classes écrites en entier :
 * Tailwind ne voit que des noms complets.
 */
const CHECKED_TONE: Record<LevelTone | "none", string> = {
  none: "has-[:checked]:border-primary has-[:checked]:bg-accent",
  good: "has-[:checked]:border-success has-[:checked]:bg-success/20",
  medium: "has-[:checked]:border-warning has-[:checked]:bg-warning/25",
  bad: "has-[:checked]:border-destructive has-[:checked]:bg-destructive/15",
};

type LevelOptionProps = {
  name: LevelFieldProps["name"];
  option: { value: string; label: string };
  checked: boolean;
};

/** Un choix de l'échelle, coloré selon le niveau une fois coché. */
function LevelOption({ name, option, checked }: LevelOptionProps) {
  const tone = option.value === "" ? "none" : levelTone(name, Number(option.value));
  return (
    <label
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-input px-3 has-[:checked]:border-2 has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${CHECKED_TONE[tone]}`}
    >
      <input
        type="radio"
        name={name}
        value={option.value}
        defaultChecked={checked}
        className="sr-only"
      />
      {option.label}
    </label>
  );
}

/** Échelle de 1 à 5 en boutons radio, avec « non renseigné » (§7.4 : fieldset + legend). */
function LevelField({ idBase, name, legend, value, error }: LevelFieldProps) {
  const noneOption = { value: "", label: t.notRated };
  const levelOptions = NOTE_LEVELS.map((level) => ({
    value: String(level),
    label: String(level),
  }));
  const describedBy = `${idBase}-hint${error !== null ? ` ${idBase}-error` : ""}`;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={describedBy}>
      <legend className="text-sm font-medium">{legend}</legend>
      {/* « Non renseigné » puis les cinq niveaux, qui restent sur une même ligne. */}
      <div className="flex flex-wrap gap-2">
        <LevelOption name={name} option={noneOption} checked={value === ""} />
        <div className="flex gap-2">
          {levelOptions.map((option) => (
            <LevelOption
              key={option.value}
              name={name}
              option={option}
              checked={value === option.value}
            />
          ))}
        </div>
      </div>
      <p id={`${idBase}-hint`} className="text-sm text-muted-foreground">
        {t.scaleHint}
      </p>
      {error !== null && (
        <p id={`${idBase}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
