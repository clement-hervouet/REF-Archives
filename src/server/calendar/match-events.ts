/**
 * Matchs → événements iCal (bloc 8, §5.4) : fonctions pures, testées sans base.
 *
 * L'événement commence 1 h avant le coup d'envoi (arrivée des arbitres) et dure 3 h.
 * L'UID dérive de l'identifiant de l'indemnité : modifier le match met à jour l'événement
 * dans l'agenda au lieu d'en créer un second, et le supprimer le retire du flux.
 */
import { addressLabel } from "@/components/features/compensations/address-label";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { formatWeekdayDateTime } from "@/lib/format";
import { buildCalendar } from "@/lib/ical";
import type { CalendarEvent } from "@/lib/ical";
import type { CalendarMatch } from "@/server/db/calendar-matches";

const t = fr.calendar;

const HOUR_MS = 60 * 60 * 1000;

/** Avance du début de l'événement sur le coup d'envoi. */
export const ARRIVAL_BEFORE_MS = HOUR_MS;
/** Durée totale de l'événement, arrivée comprise. */
export const EVENT_DURATION_MS = 3 * HOUR_MS;
/** Profondeur d'historique du flux : un match plus ancien disparaît de l'agenda abonné. */
export const FEED_HISTORY_MONTHS = 12;
/** Rafraîchissement suggéré aux agendas (indicatif). */
export const FEED_REFRESH_HOURS = 6;

/** UID iCal d'un match : identifiant de l'indemnité et suffixe fixe (indépendant du domaine). */
export function matchUid(compensationId: string): string {
  return `compensation-${compensationId}@ref-archives`;
}

/**
 * Début de la fenêtre du flux : même jour, 12 mois plus tôt. `setUTCMonth` gère le
 * changement d'année (et un 29 février devient un 1er mars, sans conséquence ici).
 */
export function feedHistoryStart(now: Date): Date {
  const from = new Date(now.getTime());
  from.setUTCMonth(from.getUTCMonth() - FEED_HISTORY_MONTHS);
  return from;
}

/** Événement d'agenda d'un match. Les remplacements passent par des fonctions : un `$&` dans un nom reste littéral. */
export function matchToEvent(match: CalendarMatch): CalendarEvent {
  const start = new Date(match.startsAt.getTime() - ARRIVAL_BEFORE_MS);
  const description = [
    t.event.tipOff.replace("{when}", () => formatWeekdayDateTime(match.startsAt)),
    t.event.level.replace("{division}", () => divisionLabel(match.division)),
    t.event.arrival,
  ].join("\n");
  return {
    uid: matchUid(match.id),
    start,
    end: new Date(start.getTime() + EVENT_DURATION_MS),
    summary: t.event.summary
      .replace("{team1}", () => match.team1Name)
      .replace("{team2}", () => match.team2Name),
    location: addressLabel(match.address),
    description,
    lastModified: match.updatedAt,
  };
}

/** Flux d'abonnement : tous les matchs donnés, avec l'intervalle de rafraîchissement. */
export function buildFeedCalendar(matches: readonly CalendarMatch[], generatedAt: Date): string {
  return buildCalendar({
    name: t.feedName,
    events: matches.map(matchToEvent),
    generatedAt,
    refreshHours: FEED_REFRESH_HOURS,
  });
}

/** Export ponctuel d'un match (fichier à importer une fois). Même UID que dans le flux. */
export function buildMatchCalendar(match: CalendarMatch, generatedAt: Date): string {
  return buildCalendar({ name: t.feedName, events: [matchToEvent(match)], generatedAt });
}
