/**
 * Healthcheck (§10.2) : point d'accès public et minimal pour le healthcheck Docker.
 *
 * Ne touche ni à la base ni à la session, n'expose aucune information (ni version, ni
 * détail interne) : il confirme seulement que le serveur répond. Déclaré public dans
 * `public-paths.ts`. `/api/health` ne contient pas de point : `proxy.ts` s'y applique et
 * pose la CSP et les en-têtes de sécurité.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return new Response("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
