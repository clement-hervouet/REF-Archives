/**
 * Manifeste de l'application installable (bloc 14), servi à `/manifest.webmanifest`.
 * Next.js ajoute lui-même `<link rel="manifest">` à toutes les pages. L'URL contient un point :
 * `src/proxy.ts` ne s'y exécute pas, le fichier reste donc lisible sans session (le
 * navigateur le lit aussi depuis la page de connexion).
 */
import type { MetadataRoute } from "next";
import { buildManifest } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return buildManifest();
}
