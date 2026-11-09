/**
 * Rappel des indisponibilités sur l'accueil (bloc 10). À faire : encadré jaune avec
 * « C'est fait pour cette semaine ». Validé : une ligne discrète, avec « Annuler » au cas
 * où le bouton aurait été touché par erreur. Formulaires HTML simples, sans JavaScript.
 */
import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { PRIMARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { SETTINGS_PATH } from "@/lib/app-paths";
import { formatShortDate } from "@/lib/weeks";
import type { AvailabilityReminderState } from "@/server/home/availability-reminder";

type Props = {
  state: AvailabilityReminderState;
  acknowledgeAction: () => Promise<void>;
  undoAction: () => Promise<void>;
};

export function AvailabilityReminderCard({ state, acknowledgeAction, undoAction }: Props) {
  if (state.kind === "hidden") {
    return null;
  }
  const date = formatShortDate(state.saturday);

  if (state.kind === "acknowledged") {
    return (
      <form action={undoAction} className="flex flex-wrap items-center gap-x-3 text-sm">
        <p className="text-muted-foreground">{fr.home.acknowledged.replace("{date}", date)}</p>
        <button type="submit" className="inline-flex min-h-11 items-center underline">
          {fr.home.undo}
        </button>
      </form>
    );
  }

  return (
    <section
      aria-labelledby="home-availability"
      className="flex flex-col gap-4 rounded-md border border-warning bg-warning/15 p-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-start gap-3">
        {/* Icône : signale l'action importante de la semaine (§3.12, icônes avec parcimonie). */}
        <CalendarCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p id="home-availability" className="font-medium">
            {fr.reminders.home.availability.replace("{date}", date)}
          </p>
          <Link href={SETTINGS_PATH} className="self-start text-sm underline">
            {fr.reminders.home.settingsLink}
          </Link>
        </div>
      </div>
      <form action={acknowledgeAction} className="shrink-0">
        <button type="submit" className={`${PRIMARY_BUTTON_CLASS} w-full md:w-auto`}>
          {fr.home.acknowledge}
        </button>
      </form>
    </section>
  );
}
