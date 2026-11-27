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

/**
 * Liste JSON d'un champ caché (autres salles d'un club) : `[]` si le champ est absent ou
 * vide. Un JSON illisible est rendu tel quel : le schéma Zod le refuse ensuite.
 */
export function readJsonList(formData: FormData, name: string): unknown {
  const text = readText(formData, name);
  if (text === undefined || text.trim() === "") {
    return [];
  }
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return text;
  }
}

/**
 * Objet JSON d'un champ caché (lien FFBB d'un club) : `undefined` si le champ est absent
 * ou vide. Un JSON illisible est rendu tel quel : le schéma Zod décide ensuite.
 */
export function readJsonValue(formData: FormData, name: string): unknown {
  const text = readText(formData, name);
  if (text === undefined || text.trim() === "") {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return text;
  }
}
