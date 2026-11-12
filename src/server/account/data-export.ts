/**
 * Export RGPD de ses données (bloc 11, §6.5) : logique pure, testée sans Next.js ni base.
 * La route `GET /parametres/export` vérifie la session, puis appelle `handleDataExport`.
 *
 * Le fichier est un JSON lisible (indenté), daté, avec un champ `format` et une `version`
 * pour qu'un futur import ou un autre outil sache ce qu'il lit. Chaque export est journalisé
 * (`data_exported`) : c'est la seule action qui sort toutes les données d'un coup.
 */
import { toParisIsoDate } from "@/lib/dates";
import { getSecurityHeaders } from "@/lib/security-headers";
import { hashIdentifier } from "../auth/rate-limit";
import type { UserDataExport } from "../db/data-export";

const DATA_EXPORT_FORMAT = "ref-archives-export";
const DATA_EXPORT_VERSION = 1;

// Le fichier n'est jamais interprété comme une page : aucune ressource, aucun cadre.
const EXPORT_CSP = "default-src 'none'; frame-ancestors 'none'";

export type DataExportDeps = {
  read: (userId: string) => Promise<UserDataExport | null>;
  /** Journal de sécurité ; ne lève jamais d'erreur (voir `security-log.ts`). */
  record: (userId: string) => Promise<void>;
};

export type DataExportResult =
  { status: "not_found" } | { status: "ok"; fileName: string; body: string };

/** Nom du fichier, d'après le jour de l'export à Paris : `ref-archives-2026-11-09.json`. */
export function dataExportFileName(now: Date): string {
  return `ref-archives-${toParisIsoDate(now)}.json`;
}

/** Document final : en-tête (format, version, date) puis les sections du compte. */
export function buildDataExportDocument(data: UserDataExport, now: Date): string {
  const document = {
    format: DATA_EXPORT_FORMAT,
    version: DATA_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    ...data,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** En-têtes d'une réponse sans fichier (404) : aucun détail, rien en cache. */
export function dataExportNotFoundHeaders(pathname: string): Record<string, string> {
  return {
    ...getSecurityHeaders(pathname),
    "Content-Security-Policy": EXPORT_CSP,
    "Cache-Control": "no-store",
  };
}

/**
 * Clés de rate limiting de l'export (§6.6, F7), hachées comme la connexion (jamais d'IP ni
 * d'identifiant en clair) : un export sort toutes les données, on borne sa fréquence par
 * compte et par IP. Mêmes compteurs `rate_limit` que la connexion et la suppression de compte.
 */
export function exportRateLimitKeys(userId: string, ip: string): string[] {
  return [`export:user:${hashIdentifier(userId)}`, `export:ip:${hashIdentifier(ip)}`];
}

/** En-têtes d'un refus pour trop d'exports (429) : comme un 404, plus `Retry-After`. */
export function dataExportRateLimitedHeaders(
  pathname: string,
  retryAfterSeconds: number,
): Record<string, string> {
  return {
    ...dataExportNotFoundHeaders(pathname),
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
  };
}

/** En-têtes du fichier : téléchargement, contenu personnel jamais mis en cache. */
export function dataExportHeaders(input: {
  pathname: string;
  fileName: string;
}): Record<string, string> {
  return {
    ...dataExportNotFoundHeaders(input.pathname),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="${input.fileName}"`,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

/** Construit l'export du compte connecté et le journalise. */
export async function handleDataExport(
  deps: DataExportDeps,
  userId: string,
  now: Date,
): Promise<DataExportResult> {
  const data = await deps.read(userId);
  if (data === null) {
    return { status: "not_found" };
  }
  await deps.record(userId);
  return {
    status: "ok",
    fileName: dataExportFileName(now),
    body: buildDataExportDocument(data, now),
  };
}
