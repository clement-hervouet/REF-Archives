/**
 * Flux d'abonnement iCal (§5.4) : `GET /api/ical/<jeton>.ics`, appelé par les agendas
 * (Google, Samsung, Apple…) sans session. L'authentification est le jeton, comparé par son
 * empreinte SHA-256 en base. Jeton mal formé, inconnu ou révoqué : 404 sans détail.
 *
 * Le jeton n'est jamais journalisé. Une erreur de base remonte en 500 sans détail.
 */
import { createCalendarFeedDeps } from "@/server/calendar/feed-deps";
import {
  FEED_FILE_NAME,
  calendarHeaders,
  notFoundHeaders,
  serveCalendarFeed,
} from "@/server/calendar/feed-response";

export const dynamic = "force-dynamic";

// Type explicite plutôt que le type généré par `next typegen` (voir CLAUDE.md §3.8).
type CalendarFeedRouteContext = { params: Promise<{ file: string }> };

export async function GET(request: Request, context: CalendarFeedRouteContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  const { file } = await context.params;
  const ics = await serveCalendarFeed(createCalendarFeedDeps(), file, new Date());
  if (ics === null) {
    return new Response(null, { status: 404, headers: notFoundHeaders(pathname) });
  }
  return new Response(ics, {
    status: 200,
    headers: calendarHeaders({ pathname, fileName: FEED_FILE_NAME, disposition: "inline" }),
  });
}
