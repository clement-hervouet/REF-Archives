/**
 * Section « Apparence » des paramètres : thème système, clair ou sombre, chacun avec un
 * petit aperçu (bloc 10). Formulaire HTML simple (aucun JavaScript côté client) : la page
 * se recharge avec le nouveau thème, posé côté serveur. Un bouton explicite plutôt qu'un
 * envoi au changement : parcourir les choix au clavier ne doit rien appliquer (§7.4).
 */
import { RADIO_INPUT_CLASS, SUBMIT_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { THEME_PREFERENCES } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

const t = fr.theme;

const LABELS: Record<ThemePreference, string> = {
  system: t.system,
  light: t.light,
  dark: t.dark,
};

/** Fausse page miniature, aux couleurs fixes (`--color-preview-*`) : elle ne suit pas le thème actif. */
function Preview({ theme }: { theme: ThemePreference }) {
  const light = (
    <span className="flex h-full flex-1 bg-preview-light">
      <span className="w-1/3 bg-preview-light-side" />
      <span className="flex flex-1 flex-col gap-1 p-1.5">
        <span className="h-1.5 w-3/4 rounded-sm bg-preview-light-ink/70" />
        <span className="h-1.5 w-1/2 rounded-sm bg-preview-light-ink/25" />
      </span>
    </span>
  );
  const dark = (
    <span className="flex h-full flex-1 bg-preview-dark">
      <span className="w-1/3 bg-preview-dark-side" />
      <span className="flex flex-1 flex-col gap-1 p-1.5">
        <span className="h-1.5 w-3/4 rounded-sm bg-preview-dark-ink/80" />
        <span className="h-1.5 w-1/2 rounded-sm bg-preview-dark-ink/30" />
      </span>
    </span>
  );
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-full overflow-hidden rounded border border-border"
    >
      {theme === "light" ? (
        light
      ) : theme === "dark" ? (
        dark
      ) : (
        <>
          {light}
          {dark}
        </>
      )}
    </span>
  );
}

type Props = {
  current: ThemePreference;
  action: (formData: FormData) => Promise<void>;
};

export function ThemeForm({ current, action }: Props) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t.legend}</legend>
        <div className="grid grid-cols-3 gap-2">
          {THEME_PREFERENCES.map((theme) => (
            <label
              key={theme}
              className="flex cursor-pointer flex-col gap-2 rounded-md border border-input p-2 has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <Preview theme={theme} />
              <span className="flex min-h-6 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  defaultChecked={theme === current}
                  className={RADIO_INPUT_CLASS}
                />
                <span className="leading-tight">{LABELS[theme]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className={SUBMIT_BUTTON_CLASS}>
        {t.submit}
      </button>
    </form>
  );
}
