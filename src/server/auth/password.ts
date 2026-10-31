/**
 * Hachage et vérification des mots de passe (argon2id).
 * Ne dépend ni de la base ni de React.
 */
import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/**
 * Paramètres du §6.1 : m ≥ 64 Mo, t ≥ 3, p ≥ 4 (à valider selon le serveur).
 * L'algorithme n'est pas passé explicitement : argon2id est le défaut de la
 * bibliothèque, et le préfixe `$argon2id$` du hash est vérifié par les tests.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 65_536, // en Kio, soit 64 Mo
  timeCost: 3,
  parallelism: 4,
} as const;

/** Hache un mot de passe. Le sel est généré aléatoirement et inclus dans le résultat. */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Vérifie un mot de passe contre un hash stocké.
 * Un hash malformé renvoie `false` plutôt qu'une exception : l'appelant ne doit
 * pas distinguer « mauvais mot de passe » de « hash illisible ».
 */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * À appeler quand l'email n'existe pas : on dépense le même temps de calcul
 * que pour un vrai compte, pour que la durée de la réponse ne révèle pas
 * l'existence du compte (§6.1, pas d'énumération). Renvoie toujours `false`.
 */
export async function verifyAgainstDummyHash(password: string): Promise<false> {
  // Hash factice calculé une seule fois, à la première utilisation.
  dummyHash ??= hashPassword(randomBytes(32).toString("base64url"));
  await verifyPassword(await dummyHash, password);
  return false;
}