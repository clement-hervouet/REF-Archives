/**
 * Constantes du formulaire « Nouvelle indemnité », partagées par le client (composants)
 * et le serveur (lecture du FormData). Sans dépendance : rien de serveur n'est embarqué
 * dans le bundle client.
 */

/** Valeur des listes de club et d'adresse qui demande d'en créer un nouveau. */
export const NEW_CHOICE = "new";

/**
 * Liste « Salle » d'un club de l'équipe 1 à plusieurs salles (`venueClub`) : `main` = salle
 * principale, identifiant = une autre salle du club, `other` = une autre adresse (liste
 * `venueAddress`, comme la case d'exception d'un club à une seule salle). Jamais de valeur
 * vide : la liste est obligatoire, et le navigateur refuserait l'envoi (« sélectionnez un
 * élément »).
 */
export const MAIN_VENUE = "main";
export const OTHER_VENUE = "other";

const ADDRESS_PARTS = ["street", "number", "postalCode", "city", "country"] as const;

export type AddressPart = (typeof ADDRESS_PARTS)[number];

/** Champ signalé en erreur, dans l'ordre du formulaire (§7.4 : erreur reliée au champ). */
export const COMPENSATION_FIELDS = [
  "date",
  "time",
  "divisionId",
  "cupRound",
  "gameCount",
  "plateauGameAmount",
  "scaleId",
  "payer",
  "team1",
  "team1.name",
  ...ADDRESS_PARTS.map((part) => `team1.${part}` as const),
  "team2",
  "team2.name",
  ...ADDRESS_PARTS.map((part) => `team2.${part}` as const),
  "venue",
  "venue.name",
  ...ADDRESS_PARTS.map((part) => `venue.${part}` as const),
  "oneWayDistance",
] as const;

export type CompensationField = (typeof COMPENSATION_FIELDS)[number];
