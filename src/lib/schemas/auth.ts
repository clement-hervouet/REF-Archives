/**
 * Schémas Zod d'authentification (§6.3). Les messages sont des codes
 * (`password.too_short`…) traduits à l'affichage via `src/i18n/fr.ts`.
 */
import { z } from "zod";
import { isTrivialPassword } from "./common-passwords";

export const EMAIL_MAX_LENGTH = 255;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Email normalisé (espaces retirés, minuscules) : l'unicité en base est insensible à la casse. */
export const emailSchema = z
  .string({ error: "email.invalid" })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, { error: "email.too_long" })
  .pipe(z.email({ error: "email.invalid" }));

/** Mot de passe à la création ou au changement : longueur minimale et refus des triviaux. */
export const passwordSchema = z
  .string({ error: "password.invalid" })
  .min(PASSWORD_MIN_LENGTH, { error: "password.too_short" })
  .max(PASSWORD_MAX_LENGTH, { error: "password.too_long" })
  .refine((value) => !isTrivialPassword(value), { error: "password.too_common" });

/**
 * Jeton reçu dans un lien : 32 octets en base64url = 43 caractères.
 * Le format est vérifié avant tout accès à la base.
 */
export const tokenSchema = z.string({ error: "token.invalid" }).regex(/^[A-Za-z0-9_-]{43}$/, {
  error: "token.invalid",
});

/**
 * Connexion : on n'applique PAS la politique de mot de passe ici, sinon un
 * message d'erreur différent révélerait des informations sur le compte.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "password.invalid" })
    .min(1, { error: "password.required" })
    .max(PASSWORD_MAX_LENGTH, { error: "password.too_long" }),
});

export type LoginInput = z.infer<typeof loginSchema>;