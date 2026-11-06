/**
 * Colonne de date d'un match (bloc 10), commune à « Mes indemnités » et « À venir » : jour
 * court, JJ/MM en grand, heure, et éventuellement une mention (« Demain »). Une ligne sur
 * téléphone, une colonne séparée par un trait sur ordinateur, comme une feuille de match.
 */
import { matchDayParts } from "@/lib/format";
import { toParisTimeOfDay } from "@/lib/paris-time";

type Props = {
  startsAt: Date;
  /** Mention sous l'heure, ex. « Demain », « Dans 5 jours ». */
  note?: string | null;
};

export function MatchDate({ startsAt, note = null }: Props) {
  const day = matchDayParts(startsAt);
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 md:flex-col md:gap-0 md:border-r md:border-border md:pr-4">
      <span className="font-semibold md:text-sm md:font-normal md:text-muted-foreground">
        {day.weekday}
      </span>
      <span className="font-semibold tabular-nums [font-stretch:85%] md:text-2xl md:leading-tight">
        {day.day}
      </span>
      <span className="ml-1 text-sm text-muted-foreground tabular-nums md:ml-0">
        {toParisTimeOfDay(startsAt)}
      </span>
      {note !== null && <span className="ml-2 text-sm font-medium md:mt-1 md:ml-0">{note}</span>}
    </p>
  );
}
