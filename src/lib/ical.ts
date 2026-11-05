/**
 * Génération de fichiers iCalendar (RFC 5545) : fonctions pures, sans dépendance.
 *
 * Seul le sous-ensemble utile aux matchs est produit : VCALENDAR + VEVENT, avec des dates
 * en UTC (suffixe `Z`), donc aucun VTIMEZONE à écrire. Pièges couverts :
 * - échappement du texte (RFC 5545 §3.3.11) : `\`, `;`, `,` et les sauts de ligne ;
 * - lignes de 75 octets au plus, pliées sans couper un caractère UTF-8 (§3.1) ;
 * - fins de ligne CRLF, y compris après la dernière ligne.
 */
import { ValidationError } from "./errors";

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;
const PRODID = "-//REF-Archives//Matchs//FR";
const MAX_REFRESH_HOURS = 168;

export type CalendarEvent = {
  /** Identifiant stable d'une version du flux à l'autre : l'agenda met à jour au lieu de dupliquer. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
  lastModified?: Date;
};

export type Calendar = {
  /** Nom proposé par les agendas à l'abonnement (`X-WR-CALNAME`). */
  name: string;
  events: readonly CalendarEvent[];
  /** Instant de génération (`DTSTAMP`), passé en paramètre pour rester testable. */
  generatedAt: Date;
  /** Rafraîchissement suggéré en heures (1 à 168). Indicatif : Google l'ignore. */
  refreshHours?: number;
};

/** Nombre d'octets UTF-8 d'un point de code. */
function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Vrai pour les caractères de contrôle interdits dans une valeur (tout sauf tab et sauts de ligne). */
function isForbiddenControl(codePoint: number): boolean {
  const allowed = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d;
  return !allowed && (codePoint < 0x20 || codePoint === 0x7f);
}

/**
 * Échappe une valeur de type TEXT. Les caractères de contrôle sont retirés : une équipe ou
 * une adresse saisie avec un caractère invisible ne doit pas casser le fichier.
 */
export function escapeText(value: string): string {
  let cleaned = "";
  for (const char of value) {
    if (!isForbiddenControl(char.codePointAt(0) ?? 0)) {
      cleaned += char;
    }
  }
  return cleaned
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Instant UTC au format iCalendar, ex. `20261106T193000Z` (millisecondes ignorées). */
export function formatUtcDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("invalid_date");
  }
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

/**
 * Plie une ligne trop longue : 75 octets pour la première, puis CRLF + espace et 74 octets
 * de contenu par suite (l'espace compte). On coupe entre deux points de code, jamais au
 * milieu d'une séquence UTF-8 (un « é » fait 2 octets).
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const octets = utf8Length(char.codePointAt(0) ?? 0);
    if (currentOctets + octets > limit) {
      parts.push(current);
      current = "";
      currentOctets = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    currentOctets += octets;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function textProperty(name: string, value: string): string {
  return foldLine(`${name}:${escapeText(value)}`);
}

function eventLines(event: CalendarEvent, stamp: string): string[] {
  if (event.uid.trim() === "") {
    throw new ValidationError("invalid_event_uid");
  }
  if (event.end.getTime() <= event.start.getTime()) {
    throw new ValidationError("invalid_event_range");
  }
  const lines = [
    "BEGIN:VEVENT",
    textProperty("UID", event.uid),
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatUtcDateTime(event.start)}`,
    `DTEND:${formatUtcDateTime(event.end)}`,
    textProperty("SUMMARY", event.summary),
  ];
  if (event.location !== undefined) {
    lines.push(textProperty("LOCATION", event.location));
  }
  if (event.description !== undefined) {
    lines.push(textProperty("DESCRIPTION", event.description));
  }
  if (event.lastModified !== undefined) {
    lines.push(`LAST-MODIFIED:${formatUtcDateTime(event.lastModified)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

function refreshLines(refreshHours: number | undefined): string[] {
  if (refreshHours === undefined) {
    return [];
  }
  if (!Number.isInteger(refreshHours) || refreshHours < 1 || refreshHours > MAX_REFRESH_HOURS) {
    throw new ValidationError("invalid_refresh_hours");
  }
  const duration = `PT${String(refreshHours)}H`;
  // REFRESH-INTERVAL est la propriété standard (RFC 7986) ; X-PUBLISHED-TTL, celle d'Outlook.
  return [`REFRESH-INTERVAL;VALUE=DURATION:${duration}`, `X-PUBLISHED-TTL:${duration}`];
}

/** Fichier `.ics` complet : lignes en CRLF, terminé par CRLF. */
export function buildCalendar(calendar: Calendar): string {
  const stamp = formatUtcDateTime(calendar.generatedAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    textProperty("X-WR-CALNAME", calendar.name),
    ...refreshLines(calendar.refreshHours),
  ];
  for (const event of calendar.events) {
    lines.push(...eventLines(event, stamp));
  }
  lines.push("END:VCALENDAR");
  return `${lines.join(CRLF)}${CRLF}`;
}
