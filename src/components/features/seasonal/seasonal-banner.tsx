/**
 * Bandeau de première apparition d'une saison (bloc 12c, §3.14) : présente le thème qui
 * vient de démarrer et propose de le garder ou de le désactiver tout de suite.
 *
 * - Discret et non bloquant : en bas de l'écran (au-dessus de la barre d'onglets sur
 *   téléphone, en bas à droite sur ordinateur), sans voile ni déplacement du focus.
 * - Formulaire HTML simple (aucun JavaScript client) : les deux boutons envoient
 *   `seasonal=on|off` à la même action que les paramètres. Les deux enregistrent la saison
 *   comme vue : le bandeau ne revient qu'à la saison suivante.
 */
import Link from "next/link";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { SETTINGS_PATH } from "@/lib/app-paths";
import type { SeasonalPeriod } from "@/lib/seasonal-theme";

const t = fr.seasonalTheme.banner;

/** Ancre du titre de la section « Thème saisonnier » de `/parametres`. */
const SETTINGS_ANCHOR = `${SETTINGS_PATH}#settings-seasonal-theme`;

type Props = {
  period: SeasonalPeriod;
  action: (formData: FormData) => Promise<void>;
};

export function SeasonalBanner({ period, action }: Props) {
  const description = period.december ? t.descriptions.december : t.descriptions[period.season];
  return (
    <section
      aria-labelledby="seasonal-banner-title"
      className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 flex flex-col gap-3 rounded-md border border-l-4 border-border border-l-primary bg-background p-4 md:inset-x-auto md:right-8 md:bottom-6 md:w-[26rem]"
    >
      <div className="flex flex-col gap-1">
        <h2 id="seasonal-banner-title" className="font-semibold">
          {t.titles[period.season]}
        </h2>
        <p className="text-sm">{description}</p>
        <p className="text-sm text-muted-foreground">
          {t.hint}{" "}
          <Link href={SETTINGS_ANCHOR} className="underline underline-offset-2">
            {t.settingsLink}
          </Link>
          .
        </p>
      </div>
      <form action={action} className="flex flex-wrap gap-2">
        <button type="submit" name="seasonal" value="on" className={PRIMARY_BUTTON_CLASS}>
          {t.keep}
        </button>
        <button type="submit" name="seasonal" value="off" className={SECONDARY_BUTTON_CLASS}>
          {t.disable}
        </button>
      </form>
    </section>
  );
}
