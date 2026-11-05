"use client";

/**
 * Note d'un match (bloc 9) : confiance et stress de 1 à 5 (boutons radio, « non
 * renseigné » possible), texte libre et liens de clips, un par ligne. Tout est
 * facultatif, mais une note vide est refusée côté serveur.
 */
import { useId } from "react";
import {
  FIELD_CLASS,
  FormMessage,
  PRIMARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import {
  CLIP_URL_MAX,
  MAX_CLIPS_PER_NOTE,
  NOTE_BODY_MAX,
  NOTE_LEVELS,
} from "@/lib/game-form-fields";
import type { NoteFormState } from "@/server/games/note-form";
import { noteFieldError, noteStatusMessage } from "./game-messages";

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
          <LevelField
            idBase={`${id}-confidence`}
            name="confidence"
            legend={t.confidence}
            value={current("confidence")}
            error={noteFieldError("confidence", state)}
          />
          <LevelField
            idBase={`${id}-stress`}
            name="stress"
            legend={t.stress}
            value={current("stress")}
            error={noteFieldError("stress", state)}
          />
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
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}

type LevelFieldProps = {
  idBase: string;
  name: "confidence" | "stress";
  legend: string;
  value: string;
  error: string | null;
};

/** Échelle de 1 à 5 en boutons radio, avec « non renseigné » (§7.4 : fieldset + legend). */
function LevelField({ idBase, name, legend, value, error }: LevelFieldProps) {
  const options = [
    { value: "", label: t.notRated },
    ...NOTE_LEVELS.map((level) => ({ value: String(level), label: String(level) })),
  ];
  const describedBy = `${idBase}-hint${error !== null ? ` ${idBase}-error` : ""}`;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={describedBy}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-input px-3 has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
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
