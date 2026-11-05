/**
 * Constantes du formulaire « Nouvelle indemnité », partagées par le client (composants)
 * et le serveur (lecture du FormData). Sans dépendance : rien de serveur n'est embarqué
 * dans le bundle client.
 */

/** Valeur des listes de club et d'adresse qui demande d'en créer un nouveau. */
export const NEW_CHOICE = "new";

export const ADDRESS_PARTS = ["street", "number", "postalCode", "city", "country"] as const;

export type AddressPart = (typeof ADDRESS_PARTS)[number];

/** Champ signalé en erreur, dans l'ordre du formulaire (§7.4 : erreur reliée au champ). */
export const COMPENSATION_FIELDS = [
  "date",
  "time",
  "divisionId",
  "scaleId",
  "team1",
  "team1.name",
  ...ADDRESS_PARTS.map((part) => `team1.${part}` as const),
  "team2",
  "team2.name",
  ...ADDRESS_PARTS.map((part) => `team2.${part}` as const),
  "venue",
  ...ADDRESS_PARTS.map((part) => `venue.${part}` as const),
  "oneWayDistance",
] as const;

export type CompensationField = (typeof COMPENSATION_FIELDS)[number];
