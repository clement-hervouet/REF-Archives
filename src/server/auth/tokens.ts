/**
 * Jetons à usage unique (invitations, vérification d'email, reset) et jeton iCal.
 * Le jeton n'est transmis que dans le lien envoyé ; seule son empreinte SHA-256
 * est stockée en base, et on ne la logge jamais.
 */
import { createHash, randomBytes } from "node:crypto";

/** 32 octets = 256 bits d'entropie. */
export const TOKEN_BYTES = 32;

export type GeneratedToken = {
  /** À placer dans le lien. Ne jamais stocker ni logger. */
  token: string;
  /** Empreinte à stocker (colonne `bytea`, 32 octets). */
  hash: Buffer;
};

/** Empreinte SHA-256 d'un jeton. Déterministe, pour retrouver la ligne en base. */
export function hashToken(token: string): Buffer {
  // SHA-256 suffit : le jeton est déjà aléatoire sur 256 bits, un hash lent
  // (argon2) n'apporterait rien et pénaliserait chaque requête.
  return createHash("sha256").update(token, "utf8").digest();
}

/** Génère un jeton aléatoire (43 caractères base64url) et son empreinte. */
export function generateToken(): GeneratedToken {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashToken(token) };
}