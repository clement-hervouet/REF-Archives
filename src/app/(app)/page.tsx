import { AvailabilityReminderCard } from "@/components/features/home/availability-reminder-card";
import { UnpaidSummaryCard } from "@/components/features/home/unpaid-summary-card";
import { WeekendSummary } from "@/components/features/home/weekend-summary";
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { requireUserOrRedirect } from "@/server/auth/session";
import { groupByPayer, summarizeUnpaid } from "@/server/compensation/payments";
import { listUnpaidPlayedCompensations } from "@/server/db/payments";
import { getDb } from "@/server/db/pool";
import { getAvailabilityAckWeek, getReminderSettings } from "@/server/db/reminders";
import { listUpcomingMatches } from "@/server/db/upcoming-matches";
import { availabilityReminderState } from "@/server/home/availability-reminder";
import { upcomingRanges } from "@/server/reminders/upcoming";
import { acknowledgeAvailabilityAction, undoAvailabilityAcknowledgementAction } from "./actions";

/**
 * Accueil (bloc 10) : rappel des indisponibilités de la semaine, matchs du weekend et
 * indemnités jouées en attente de paiement.
 */
export default async function HomePage() {
  // Chaque page vérifie elle-même (§6.2) ; requêtes filtrées par l'utilisateur de la session.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const now = new Date();
  const today = toParisIsoDate(now);
  const ranges = upcomingRanges(today);
  const [settings, ackWeek, weekendMatches, unpaid] = await Promise.all([
    getReminderSettings(db, user.id),
    getAvailabilityAckWeek(db, user.id),
    listUpcomingMatches(db, { userId: user.id, ...ranges.weekend }),
    listUnpaidPlayedCompensations(db, { userId: user.id, before: now }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold">
        {fr.reminders.home.greeting.replace("{firstname}", user.firstname)}
      </h1>

      {settings !== null && (
        <AvailabilityReminderCard
          state={availabilityReminderState(settings, ackWeek, today)}
          acknowledgeAction={acknowledgeAvailabilityAction}
          undoAction={undoAvailabilityAcknowledgementAction}
        />
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <WeekendSummary saturday={ranges.saturday} today={today} matches={weekendMatches} />
        <UnpaidSummaryCard summary={summarizeUnpaid(unpaid)} byPayer={groupByPayer(unpaid)} />
      </div>
    </div>
  );
}
