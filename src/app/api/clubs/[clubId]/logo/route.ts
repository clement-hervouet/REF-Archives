/**
 * Logo d'un club (pastille) : `GET /api/clubs/<clubId>/logo?v=<uuid du logo>`. Réservé au
 * propriétaire du club et aux destinataires d'une préparation partagée de ce club ;
 * personne de connecté, club introuvable ou sans logo exploitable : 404 sans détail, et la
 * pastille montre les initiales.
 *
 * L'URL change avec le logo (`v`) : la réponse se garde longtemps dans le cache du
 * navigateur, jamais dans un cache partagé (`private`).
 */
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getClubLogo } from "@/server/clubs/club-logo";
import { getDb } from "@/server/db/pool";
import { createFetchLogo } from "@/server/ffbb/ffbb-logos";
import { withPreparedLogo } from "@/server/ffbb/logo-background";

export const dynamic = "force-dynamic";

// Type explicite plutôt que le type généré par `next typegen` (voir CLAUDE.md §3.8).
type ClubLogoRouteContext = { params: Promise<{ clubId: string }> };

const clubIdSchema = z.uuid();

function notFound(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: ClubLogoRouteContext): Promise<Response> {
  const user = await getCurrentUser();
  const clubId = clubIdSchema.safeParse((await context.params).clubId);
  if (user === null || !clubId.success) {
    return notFound();
  }
  const image = await getClubLogo(
    { db: getDb(), fetchLogo: withPreparedLogo(createFetchLogo()) },
    { userId: user.id, clubId: clubId.data, now: new Date() },
  );
  if (image === null) {
    return notFound();
  }
  return new Response(Buffer.from(image.bytes), {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    },
  });
}
