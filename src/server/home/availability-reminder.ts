/**
 * Rappel des indisponibilités sur l'accueil (bloc 10) : visible toute la semaine tant que
 * l'utilisateur n'a pas indiqué « c'est fait », puis masqué jusqu'au lundi suivant.
 * Pur : ni base ni React.
 */
import { mondayOf } from "@/lib/weeks";
import { availabilityTargetSaturday } from "@/server/reminders/schedule";
import type { ReminderSettings } from "@/server/reminders/schedule";

export type AvailabilityReminderState =
  | { kind: "hidden" }
  /** À faire : samedi du weekend visé (le même que l'email du lundi). */
  | { kind: "due"; saturday: string }
  /** Validé pour cette semaine : une ligne discrète permet d'annuler. */
  | { kind: "acknowledged"; saturday: string };

/** Semaine à enregistrer quand l'utilisateur valide : le lundi de la semaine en cours. */
export function acknowledgementWeek(today: string): string {
  return mondayOf(today);
}

export function availabilityReminderState(
  settings: Pick<ReminderSettings, "availabilityReminderEnabled" | "availabilityReminderWeeks">,
  ackWeek: string | null,
  today: string,
): AvailabilityReminderState {
  if (!settings.availabilityReminderEnabled) {
    return { kind: "hidden" };
  }
  const saturday = availabilityTargetSaturday(today, settings.availabilityReminderWeeks);
  // Une validation d'une semaine passée ne compte plus : le rappel revient chaque lundi.
  return ackWeek === acknowledgementWeek(today)
    ? { kind: "acknowledged", saturday }
    : { kind: "due", saturday };
}
