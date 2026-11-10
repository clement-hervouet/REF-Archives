/**
 * `GET /hors-ligne` (bloc 14) : page montrée par le service worker sans réseau.
 *
 * Route Handler et non page React : la page doit s'afficher sans aucun script ni fichier de
 * Next.js (rien de cela n'est en cache sur l'appareil). Route publique (`public-paths.ts`) :
 * le service worker la met en cache même quand personne n'est connecté. `proxy.ts` y pose la
 * CSP et les en-têtes de sécurité, comme partout.
 */
import { renderOfflinePage } from "@/lib/offline-page";

export function GET(): Response {
  return new Response(renderOfflinePage(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Toujours revalidée : le service worker l'enregistre lui-même à son installation.
      "Cache-Control": "no-cache",
    },
  });
}
