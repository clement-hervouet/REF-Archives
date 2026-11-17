/**
 * Vérification d'un nouveau mot de passe pendant la saisie (création du compte,
 * réinitialisation, « Changer mon mot de passe »). Mêmes règles que `passwordSchema`, qui
 * reste seul juge côté serveur : ceci ne sert qu'à guider la saisie.
 */
import { PASSWORD_MIN_LENGTH } from "./schemas/auth";
import { isTrivialPassword } from "./schemas/common-passwords";

/** `empty` : rien à juger pour l'instant (champ vide), affiché en neutre. */
export type PasswordRuleState = "empty" | "ok" | "ko";

export type PasswordRules = {
  length: PasswordRuleState;
  notCommon: PasswordRuleState;
  match: PasswordRuleState;
};

export function evaluatePasswordRules(password: string, confirmation: string): PasswordRules {
  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  return {
    length: password === "" ? "empty" : longEnough ? "ok" : "ko",
    // La liste ne contient que des mots de passe d'au moins 12 caractères : on ne juge
    // qu'une fois la longueur atteinte, sinon « pas trop courant » serait coché pour « a ».
    notCommon: !longEnough ? "empty" : isTrivialPassword(password) ? "ko" : "ok",
    match: confirmation === "" ? "empty" : confirmation === password ? "ok" : "ko",
  };
}
