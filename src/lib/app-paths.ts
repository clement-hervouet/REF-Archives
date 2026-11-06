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

/** Page « Mes collègues » : fiches nom seul (bloc 9). */
export const COLLEAGUES_PATH = "/collegues";

/** Fiche d'un match complet (bloc 9). */
export function gamePath(gameId: string): string {
  return `/matchs/${gameId}`;
}

/** Création du match complet d'une indemnité (« Compléter le match », bloc 9). */
export function completeGamePath(compensationId: string): string {
  return `/indemnites/${compensationId}/match`;
}

/** Page « Notes de match » : matchs notés, filtrables (bloc 9). */
export const GAME_NOTES_PATH = "/notes";

/** Page « Compléter mon profil » : nom et prénom obligatoires avant tout le reste (bloc 10). */
export const COMPLETE_PROFILE_PATH = "/completer-profil";

/** Page « À rembourser » : indemnités jouées non payées, validation des paiements (bloc 10). */
export const UNPAID_PATH = "/indemnites/a-rembourser";
