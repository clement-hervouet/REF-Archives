/**
 * Conversion d'une date et d'une heure saisies à Paris (« 14/11/2026 à 19:00 ») en
 * instant UTC (§5.6 : stockage en UTC, affichage et saisie en Europe/Paris), sans
 * dépendance et quel que soit le fuseau du serveur.
 */
import { assertIsoDate } from "./dates";
import { ValidationError } from "./errors";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Douze heures : de part et d'autre d'un changement d'heure, les décalages diffèrent. */
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

// `h23` : minuit s'écrit 00, jamais 24 (piège connu de `hour12: false`).
const parisPartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Vrai si `value` est une heure `HH:MM` (00:00 à 23:59). */
export function isTimeOfDay(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/**
 * Heure murale de Paris à l'instant `instantMs`, exprimée comme si elle était en UTC
 * (en millisecondes). La différence avec `instantMs` est le décalage de Paris.
 */
function parisWallClockMs(instantMs: number): number {
  const values = new Map<string, number>();
  for (const part of parisPartsFormat.formatToParts(new Date(instantMs))) {
    values.set(part.type, Number(part.value));
  }
  const get = (type: string): number => values.get(type) ?? 0;
  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
}

/**
 * Instant UTC correspondant à `isoDate` (`AAAA-MM-JJ`) à `time` (`HH:MM`), heure de Paris.
 *
 * - Heure qui n'existe pas (passage à l'heure d'été, ex. 02:30 le dernier dimanche de
 *   mars) : `ValidationError("nonexistent_local_time")`, l'utilisateur corrige.
 * - Heure ambiguë (retour à l'heure d'hiver, 02:30 existe deux fois) : la première
 *   occurrence, en heure d'été.
 */
export function parisLocalToUtc(isoDate: string, time: string): Date {
  assertIsoDate(isoDate);
  const timeMatch = TIME_PATTERN.exec(time);
  if (timeMatch === null) {
    throw new ValidationError("invalid_time");
  }
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  const wallMs = Date.UTC(year, month - 1, day, Number(timeMatch[1]), Number(timeMatch[2]));

  // Décalages possibles autour de cette heure ; on garde ceux qui retombent sur l'heure saisie.
  const offsets = new Set<number>();
  for (const probe of [wallMs - HALF_DAY_MS, wallMs + HALF_DAY_MS]) {
    offsets.add(parisWallClockMs(probe) - probe);
  }
  const candidates = [...offsets]
    .map((offset) => wallMs - offset)
    .filter((candidate) => parisWallClockMs(candidate) === wallMs)
    .sort((a, b) => a - b);

  const first = candidates[0];
  if (first === undefined) {
    throw new ValidationError("nonexistent_local_time");
  }
  return new Date(first);
}
