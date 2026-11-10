/**
 * Section « Thème saisonnier » des paramètres (bloc 12, §3.14) : animation activée ou
 * désactivée pour la saison en cours, et densité. Formulaire HTML simple, comme
 * « Apparence » : un bouton explicite, parcourir les choix au clavier n'applique rien (§7.4).
 */
import { SUBMIT_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { SEASONAL_DENSITIES } from "@/lib/seasonal-theme";
import type { SeasonalState } from "@/lib/seasonal-theme";

const t = fr.seasonalTheme;

const CHOICE_CLASS =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

type Props = {
  state: SeasonalState;
  action: (formData: FormData) => Promise<void>;
};

/** « En ce moment : automne, feuilles qui tombent. » */
function currentLabel({ period }: SeasonalState): string {
  const effect = period.december ? t.effects.december : t.effects[period.season];
  return t.current.replace("{season}", t.seasons[period.season]).replace("{effect}", effect);
}

export function SeasonalThemeForm({ state, action }: Props) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <p>{currentLabel(state)}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.stateLegend}</legend>
        <label className={CHOICE_CLASS}>
          <input
            type="radio"
            name="seasonal"
            value="on"
            defaultChecked={state.enabled}
            className="size-4 shrink-0 accent-primary"
          />
          <span className="leading-tight">{t.on}</span>
        </label>
        <label className={CHOICE_CLASS}>
          <input
            type="radio"
            name="seasonal"
            value="off"
            defaultChecked={!state.enabled}
            className="size-4 shrink-0 accent-primary"
          />
          <span className="leading-tight">{t.off}</span>
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t.densityLegend}</legend>
        <div className="grid grid-cols-3 gap-2">
          {SEASONAL_DENSITIES.map((density) => (
            <label key={density} className={CHOICE_CLASS}>
              <input
                type="radio"
                name="density"
                value={density}
                defaultChecked={density === state.density}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="leading-tight">{t.densities[density]}</span>
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
