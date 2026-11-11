/**
 * Lecture d'un champ texte d'un `FormData`, partagée par tous les formulaires serveur.
 * Rien n'est validé ici : un champ absent ou un fichier devient `undefined`, que les
 * schémas Zod refusent ensuite (§6.3).
 */

/** Valeur texte d'un champ ; un fichier ou un champ absent devient `undefined`. */
export function readText(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}
