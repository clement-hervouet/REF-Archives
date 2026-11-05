/**
 * Export ponctuel d'un match (§5.4) : `GET /indemnites/<id>/ics` télécharge un fichier
 * `.ics` à importer une fois dans un agenda. Même UID que dans le flux : importer le match
 * puis s'abonner ne crée pas de doublon dans les agendas qui dédupliquent par UID.
 *
 * Route Handler (§6.2) : session vérifiée en base ET propriété de l'indemnité. Personne de
 * connecté, identifiant invalide, indemnité d'un autre compte ou supprimée : même 404.
 */
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  calendarHeaders,
  matchExportFileName,
  notFoundHeaders,
} from "@/server/calendar/feed-response";
import { buildMatchCalendar } from "@/server/calendar/match-events";
import { findCalendarMatch } from "@/server/db/calendar-matches";
import { getDb } from "@/server/db/pool";

export const dynamic = "force-dynamic";

// Type explicite plutôt que le type généré par `next typegen` (voir CLAUDE.md §3.8).
type MatchExportRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: MatchExportRouteContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  const notFound = () => new Response(null, { status: 404, headers: notFoundHeaders(pathname) });

  const user = await getCurrentUser();
  if (user === null) {
    return notFound();
  }
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) {
    return notFound();
  }
  const match = await findCalendarMatch(getDb(), { compensationId: id.data, userId: user.id });
  if (match === null) {
    return notFound();
  }
  return new Response(buildMatchCalendar(match, new Date()), {
    status: 200,
    headers: calendarHeaders({
      pathname,
      fileName: matchExportFileName(match),
      disposition: "attachment",
    }),
  });
}
