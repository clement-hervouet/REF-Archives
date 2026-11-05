/**
 * Section « Apparence » des paramètres : thème système, clair ou sombre.
 * Formulaire HTML simple (aucun JavaScript côté client) : la page se recharge avec le
 * nouveau thème, posé côté serveur.
 */
import { SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { THEME_PREFERENCES } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";

const t = fr.theme;

const LABELS: Record<ThemePreference, string> = {
  system: t.system,
  light: t.light,
  dark: t.dark,
};

type Props = {
  current: ThemePreference;
  action: (formData: FormData) => Promise<void>;
};

export function ThemeForm({ current, action }: Props) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t.legend}</legend>
        <div className="flex flex-wrap gap-2">
          {THEME_PREFERENCES.map((theme) => (
            <label
              key={theme}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-4 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:font-medium"
            >
              <input
                type="radio"
                name="theme"
                value={theme}
                defaultChecked={theme === current}
                className="size-4 accent-primary"
              />
              <span>{LABELS[theme]}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t.hint}</p>
      </fieldset>
      <button type="submit" className={`${SECONDARY_BUTTON_CLASS} self-start`}>
        {t.submit}
      </button>
    </form>
  );
}
