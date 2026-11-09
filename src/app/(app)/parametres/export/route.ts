/**
 * Export RGPD (bloc 11, §6.5) : `GET /parametres/export` télécharge toutes les données du
 * compte connecté dans un fichier JSON.
 *
 * Route Handler (§6.2) : session vérifiée en base ; l'export ne lit que le compte de la
 * session, aucun identifiant n'est pris dans l'URL. Personne de connecté : 404 sans détail.
 * Lecture seule : un site tiers peut déclencher le téléchargement (lien), mais pas lire le
 * fichier, qui part sur la machine de l'utilisateur ; la CSRF ne s'applique donc pas.
 */
import { headers } from "next/headers";
import {
  dataExportHeaders,
  dataExportNotFoundHeaders,
  handleDataExport,
} from "@/server/account/data-export";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { getCurrentUser } from "@/server/auth/session";
import { readUserDataExport } from "@/server/db/data-export";
import { getDb } from "@/server/db/pool";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const notFound = () =>
    new Response(null, { status: 404, headers: dataExportNotFoundHeaders(pathname) });

  const user = await getCurrentUser();
  if (user === null) {
    return notFound();
  }
  const ip = getClientIp(await headers());
  const result = await handleDataExport(
    {
      read: (userId) => readUserDataExport(getDb(), userId),
      record: (userId) => recordSecurityEvent({ type: "data_exported", userId, ip }),
    },
    user.id,
    new Date(),
  );
  if (result.status === "not_found") {
    return notFound();
  }
  return new Response(result.body, {
    status: 200,
    headers: dataExportHeaders({ pathname, fileName: result.fileName }),
  });
}
