"use client";

/**
 * Champ date avec un calendrier propre à l'application (react-day-picker), à la place du
 * calendrier natif : sur téléphone, celui-ci suit les réglages du téléphone et pouvait
 * commencer la semaine le dimanche. Ici, semaine du lundi au dimanche, en français, aux
 * couleurs du thème, identique partout.
 *
 * - La valeur envoyée reste `AAAA-MM-JJ`, dans un champ texte caché du formulaire : les
 *   Server Actions et les schémas Zod ne changent pas.
 * - Ce champ caché est non contrôlé, et chaque choix y est écrit comme une vraie saisie
 *   (événement `input`) : les `onChange` des formulaires et fieldsets parents (aperçu de
 *   l'indemnité, plateaux selon la date…) le voient comme avant.
 * - Le calendrier s'ouvre dans un `<dialog>` modal : focus piégé, Échap pour fermer, retour
 *   du focus sur le bouton, navigation au clavier dans les jours (react-day-picker).
 * - La date du jour et les bornes sont des dates locales : pas de fuseau en jeu, on ne
 *   manipule que l'année, le mois et le jour.
 */
import { CalendarDays } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { Matcher } from "react-day-picker";
import { fr as frLocale } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { FIELD_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.datePicker;

/** Années proposées par défaut dans la liste du calendrier (sans borne min / max). */
const FIRST_YEAR = 2010;
const YEARS_AHEAD = 5;

const DISPLAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** `AAAA-MM-JJ` → date locale à minuit, ou `undefined` si la valeur n'est pas une date. */
function parseIsoDate(value: string | undefined): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (match === null) {
    return undefined;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // Refuse un 31 février : `Date` le ferait glisser au mois suivant.
  return date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** Écrit la valeur comme une saisie : React déclenche alors les `onChange` parents. */
function writeInputValue(input: HTMLInputElement, value: string) {
  // Setter du prototype : celui de l'élément est surveillé par React, qui ne verrait alors
  // aucun changement à signaler.
  Reflect.set(HTMLInputElement.prototype, "value", value, input);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

type Props = {
  id: string;
  name: string;
  label: string;
  /** Valeur initiale `AAAA-MM-JJ` (vide : aucune date choisie). */
  defaultValue: string;
  error?: string | null;
  hint?: string | undefined;
  /** Bornes incluses, `AAAA-MM-JJ`. */
  min?: string | undefined;
  max?: string | undefined;
  /** Appelé à chaque changement (choix, ou remise à zéro du formulaire). */
  onValueChange?: (value: string) => void;
  /** Classes du conteneur (largeur du champ). */
  className?: string;
};

export function DateField({
  id,
  name,
  label,
  defaultValue,
  error = null,
  hint,
  min,
  max,
  onValueChange,
  className,
}: Props) {
  const labelId = useId();
  const valueId = `${id}-value`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onValueChangeRef = useRef(onValueChange);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  });

  // React vide les formulaires à action après l'envoi (`reset`) : le champ caché reprend sa
  // valeur initiale, l'affichage doit suivre. L'événement part avant la remise à zéro.
  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (input === null || form === null || form === undefined) {
      return;
    }
    function onReset() {
      window.setTimeout(() => {
        if (input !== null) {
          setValue(input.value);
          onValueChangeRef.current?.(input.value);
        }
      }, 0);
    }
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("reset", onReset);
    };
  }, []);

  const selected = parseIsoDate(value);
  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const disabled: Matcher[] = [];
  if (minDate !== undefined) disabled.push({ before: minDate });
  if (maxDate !== undefined) disabled.push({ after: maxDate });
  const todayAllowed =
    (minDate === undefined || today >= minDate) && (maxDate === undefined || today <= maxDate);

  function openCalendar() {
    setOpen(true);
    dialogRef.current?.showModal();
  }

  function closeCalendar() {
    dialogRef.current?.close();
  }

  function choose(date: Date | undefined) {
    // Un second clic sur le jour choisi le désélectionnerait : le champ reste rempli.
    if (date === undefined) {
      closeCalendar();
      return;
    }
    const iso = toIsoDate(date);
    if (inputRef.current !== null) {
      writeInputValue(inputRef.current, iso);
    }
    setValue(iso);
    onValueChange?.(iso);
    closeCalendar();
  }

  const describedBy =
    [hint !== undefined ? hintId : null, error !== null ? errorId : null]
      .filter((part) => part !== null)
      .join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label id={labelId} htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        hidden
        name={name}
        defaultValue={defaultValue}
        autoComplete="off"
        tabIndex={-1}
      />
      <button
        id={id}
        type="button"
        onClick={openCalendar}
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${valueId}`}
        aria-describedby={describedBy}
        className={cn(
          FIELD_CLASS,
          "flex items-center justify-between gap-2 text-left",
          // `aria-invalid` n'existe pas pour un bouton : l'erreur est reliée par
          // `aria-describedby`, la bordure rouge reste pour l'œil.
          error !== null && "border-destructive",
        )}
      >
        <span id={valueId} className={cn(selected === undefined && "text-muted-foreground")}>
          {selected === undefined ? t.placeholder : DISPLAY_FORMAT.format(selected)}
        </span>
        <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </button>
      {hint !== undefined && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== null && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {/* Clic sur le fond (hors du contenu) = fermeture, comme Échap. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={labelId}
        onClose={() => {
          setOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeCalendar();
          }
        }}
        className="fixed inset-0 m-auto h-fit w-fit max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-overlay"
      >
        {/* Rendu seulement à l'ouverture : il repart du mois de la date choisie et prend le focus. */}
        {open && (
          <div className="flex flex-col gap-3 p-3">
            <DayPicker
              mode="single"
              required={false}
              selected={selected}
              onSelect={choose}
              defaultMonth={selected ?? (todayAllowed ? today : (minDate ?? maxDate ?? today))}
              locale={frLocale}
              weekStartsOn={1}
              captionLayout="dropdown"
              startMonth={minDate ?? new Date(FIRST_YEAR, 0, 1)}
              endMonth={maxDate ?? new Date(today.getFullYear() + YEARS_AHEAD, 11, 31)}
              disabled={disabled}
              autoFocus
              className="date-picker"
            />
            <div className="flex justify-between gap-2">
              <button
                type="button"
                disabled={!todayAllowed}
                onClick={() => {
                  choose(today);
                }}
                className={SECONDARY_BUTTON_CLASS}
              >
                {t.today}
              </button>
              <button type="button" onClick={closeCalendar} className={SECONDARY_BUTTON_CLASS}>
                {t.close}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
