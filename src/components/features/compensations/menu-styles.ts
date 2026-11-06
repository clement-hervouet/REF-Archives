/**
 * Classes du menu « Plus d'actions ». Dans un module neutre (ni "use client" ni serveur) :
 * une constante exportée par un fichier "use client" n'est, vue d'un composant serveur,
 * qu'une référence client, pas la chaîne elle-même.
 */

/** Élément du menu (lien ou bouton). */
export const MENU_ITEM_CLASS =
  "flex min-h-11 w-full items-center rounded-sm px-3 text-left hover:bg-accent disabled:opacity-60";
