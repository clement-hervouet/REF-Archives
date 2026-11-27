/**
 * Matchs de la semaine en cours sur l'accueil, d'aujourd'hui au dimanche (matchs de semaine
 * compris) : version courte de « À venir ». Mêmes cartes, avec la date en légende sur la
 * bordure, sans adresse, et le menu « ⋯ » en bulle dans le coin (« Itinéraire » compris).
 */
import Link from "next/link";
import { UpcomingMatchList } from "@/components/features/reminders/upcoming-match-list";
import { fr } from "@/i18n/fr";
import { UPCOMING_PATH } from "@/lib/app-paths";
import { formatShortDate } from "@/lib/weeks";
import type { UpcomingMatchRow } from "@/server/db/upcoming-matches";
import type { PrepareMatchState } from "@/server/games/preparation-form";

const t = fr.home;

type Props = {
  /** Dimanche de la semaine en cours (`AAAA-MM-JJ`). */
  sunday: string;
  /** Jour de Paris (`AAAA-MM-JJ`), pour « Demain », « Dans 3 jours ». */
  today: string;
  matches: readonly UpcomingMatchRow[];
  /** « Préparer le match » dans le menu (§15.4.10). */
  prepareAction: (previous: PrepareMatchState, formData: FormData) => Promise<PrepareMatchState>;
};

export function WeekSummary({ sunday, today, matches, prepareAction }: Props) {
  return (
    <section aria-labelledby="home-week" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="home-week" className="text-xl font-semibold">
          {t.weekTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.weekRange.replace("{sunday}", formatShortDate(sunday))}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-md border border-border p-4">{fr.reminders.home.weekNone}</p>
      ) : (
        <UpcomingMatchList
          matches={matches}
          today={today}
          variant="home"
          prepareAction={prepareAction}
        />
      )}

      <Link href={UPCOMING_PATH} className="inline-flex min-h-11 items-center self-start underline">
        {fr.reminders.home.seeUpcoming}
      </Link>
    </section>
  );
}
