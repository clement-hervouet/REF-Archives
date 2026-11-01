/**
 * Formatage pour l'affichage. Les dates sont stockées en UTC et affichées en
 * Europe/Paris (§5.6), quel que soit le fuseau du serveur ou du navigateur.
 */
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Date et heure courtes, ex. « 01/11/2026 11:00 ». */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}