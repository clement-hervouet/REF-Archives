/**
 * Chemins partagés : pages citées dans les emails et la navigation, URL du flux iCal et
 * export d'un match. Source unique pour ne pas recopier ces chaînes à plusieurs endroits.
 */

/** Page « Paramètres » : réglages des rappels (bloc 7) et lien d'abonnement iCal (bloc 8). */
export const SETTINGS_PATH = "/parametres";

/** Page « À venir » : matchs prévus, récapitulatif du weekend (bloc 7). */
export const UPCOMING_PATH = "/a-venir";

/** Flux d'abonnement iCal (bloc 8). Le chemin contient le jeton : ne jamais le journaliser. */
export function calendarFeedPath(token: string): string {
  return `/api/ical/${token}.ics`;
}

/** Export ponctuel d'un match au format `.ics` (bloc 8), réservé à son propriétaire. */
export function matchExportPath(compensationId: string): string {
  return `/indemnites/${compensationId}/ics`;
}
