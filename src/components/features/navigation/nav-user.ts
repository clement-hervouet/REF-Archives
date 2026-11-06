/**
 * Ce que la navigation affiche de l'utilisateur. Construit côté serveur par le layout :
 * jamais de rôle ni d'identifiant de session envoyé au client au-delà du nécessaire.
 */
export type NavUser = {
  firstname: string;
  lastname: string;
  email: string;
  /** Affiche les liens d'administration (confort : chaque page admin vérifie elle-même). */
  isAdmin: boolean;
};
