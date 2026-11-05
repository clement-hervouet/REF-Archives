/**
 * Gestion du lien d'abonnement iCal (bloc 8) : créer, régénérer, révoquer. Ni Next.js ni
 * authentification ici : la Server Action vérifie la session et fournit l'utilisateur
 * (jamais lu dans le formulaire, §6.2). Dépendances injectées : testable sans base.
 *
 * Le jeton n'existe qu'en mémoire le temps de construire l'URL, renvoyée une seule fois
 * dans l'état de l'action ; seule son empreinte est stockée. L'URL part de `APP_URL`,
 * jamais de l'en-tête `Host` (§3.6).
 */
import { calendarFeedPath } from "@/lib/app-paths";
import { parseCalendarFeedIntent } from "@/lib/schemas/calendar";
import { generateToken } from "@/server/auth/tokens";
import type { GeneratedToken } from "@/server/auth/tokens";
import type { SecurityEventType } from "@/server/db/security-events";

export type CalendarFeedState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "revoked" }
  | {
      status: "created";
      /** URL https complète du flux, montrée une seule fois. */
      url: string;
      /** Même URL en `webcal://`, qui ouvre directement l'application d'agenda. */
      webcalUrl: string;
    };

export type ManageCalendarFeedDeps = {
  replace: (userId: string, tokenHash: Buffer) => Promise<unknown>;
  remove: (userId: string) => Promise<boolean>;
  /** Journal de sécurité ; ne lève jamais d'erreur (voir `security-log.ts`). */
  record: (type: SecurityEventType, userId: string) => Promise<void>;
  /** `APP_URL` validée, sans barre oblique finale. */
  appUrl: string;
  generate?: () => GeneratedToken;
};

/** `https://…` ou `http://…` → `webcal://…` (même adresse, schéma reconnu par les agendas). */
export function toWebcalUrl(url: string): string {
  return url.replace(/^https?:\/\//, "webcal://");
}

async function createLink(
  deps: ManageCalendarFeedDeps,
  userId: string,
): Promise<CalendarFeedState> {
  const { token, hash } = (deps.generate ?? generateToken)();
  await deps.replace(userId, hash);
  await deps.record("calendar_feed_created", userId);
  const url = `${deps.appUrl}${calendarFeedPath(token)}`;
  return { status: "created", url, webcalUrl: toWebcalUrl(url) };
}

async function revokeLink(
  deps: ManageCalendarFeedDeps,
  userId: string,
): Promise<CalendarFeedState> {
  if (!(await deps.remove(userId))) {
    return { status: "not_found" };
  }
  await deps.record("calendar_feed_revoked", userId);
  return { status: "revoked" };
}

/** Traite le formulaire de gestion du lien pour l'utilisateur de la session. */
export async function handleManageCalendarFeed(
  deps: ManageCalendarFeedDeps,
  userId: string,
  formData: FormData,
): Promise<CalendarFeedState> {
  const intent = parseCalendarFeedIntent(formData);
  if (intent === null) {
    return { status: "invalid" };
  }
  return intent === "create" ? createLink(deps, userId) : revokeLink(deps, userId);
}
