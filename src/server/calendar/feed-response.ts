/**
 * Réponses des routes iCal (bloc 8) : logique pure, testée sans Next.js ni base.
 *
 * - Flux d'abonnement (`/api/ical/<jeton>.ics`) : public pour `proxy.ts`, l'authentification
 *   est le jeton. Jeton mal formé, inconnu ou révoqué : même 404, sans détail. Pas de rate
 *   limiting : un jeton aléatoire de 256 bits ne se devine pas (même choix que /api/cron).
 * - En-têtes : le proxy ne s'exécute pas sur une URL qui contient un point (`.ics`), la route
 *   pose donc elle-même ses en-têtes de sécurité. `no-store` : le contenu est personnel et
 *   l'URL contient un secret, aucun cache intermédiaire ne doit le garder.
 */
import { toParisIsoDate } from "@/lib/dates";
import { parseCalendarFeedFile } from "@/lib/schemas/calendar";
import { getSecurityHeaders } from "@/lib/security-headers";
import { hashToken } from "@/server/auth/tokens";
import type { CalendarMatch } from "@/server/db/calendar-matches";
import { buildFeedCalendar, feedHistoryStart } from "./match-events";

/** Nom proposé quand un agenda (ou un navigateur) enregistre le flux. */
export const FEED_FILE_NAME = "ref-archives.ics";

// Le fichier n'est jamais interprété comme une page : aucune ressource, aucun cadre.
const CALENDAR_CSP = "default-src 'none'; frame-ancestors 'none'";

export type CalendarFeedDeps = {
  findUserIdByTokenHash: (tokenHash: Buffer) => Promise<string | null>;
  listMatchesSince: (input: { userId: string; from: Date }) => Promise<CalendarMatch[]>;
};

/** En-têtes d'une réponse 404 des routes iCal (aucun détail, rien en cache). */
export function notFoundHeaders(pathname: string): Record<string, string> {
  return {
    ...getSecurityHeaders(pathname),
    "Content-Security-Policy": CALENDAR_CSP,
    "Cache-Control": "no-store",
  };
}

/** En-têtes d'un fichier `.ics` : `inline` pour le flux, `attachment` pour un export. */
export function calendarHeaders(input: {
  pathname: string;
  fileName: string;
  disposition: "inline" | "attachment";
}): Record<string, string> {
  return {
    ...notFoundHeaders(input.pathname),
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `${input.disposition}; filename="${input.fileName}"`,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

/** Nom du fichier d'export d'un match, d'après sa date à Paris : `match-2026-11-06.ics`. */
export function matchExportFileName(match: Pick<CalendarMatch, "startsAt">): string {
  return `match-${toParisIsoDate(match.startsAt)}.ics`;
}

/**
 * Contenu du flux pour le nom de fichier demandé, ou `null` (404) si le jeton est mal
 * formé, inconnu ou révoqué. Le jeton n'est ni journalisé ni renvoyé.
 */
export async function serveCalendarFeed(
  deps: CalendarFeedDeps,
  file: string,
  now: Date,
): Promise<string | null> {
  const token = parseCalendarFeedFile(file);
  if (token === null) {
    return null;
  }
  const userId = await deps.findUserIdByTokenHash(hashToken(token));
  if (userId === null) {
    return null;
  }
  const matches = await deps.listMatchesSince({ userId, from: feedHistoryStart(now) });
  return buildFeedCalendar(matches, now);
}
