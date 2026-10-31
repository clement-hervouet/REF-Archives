/**
 * Refus des mots de passe triviaux (§6.1) : liste de mots de passe courants
 * et motifs répétés. Volontairement sans règle de complexité artificielle.
 */

/**
 * Mots de passe courants, en minuscules. Les mots de passe de moins de
 * 12 caractères sont déjà refusés par la longueur minimale.
 */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password1234",
  "password12345",
  "passwordpassword",
  "motdepasse123",
  "motdepasse1234",
  "monmotdepasse",
  "monmotdepasse1",
  "123456789012",
  "1234567890123",
  "12345678901234",
  "1q2w3e4r5t6y",
  "1qaz2wsx3edc",
  "azertyuiop12",
  "azertyuiopqs",
  "azertyuiopqsdf",
  "azertyazerty",
  "qwertyuiop12",
  "qwertyuiopas",
  "qwertyqwerty",
  "abcdefghijkl",
  "abcdefghijklm",
  "iloveyou1234",
  "letmein123456",
  "welcome12345",
  "changeme1234",
  "changemechangeme",
  "administrator",
  "administrateur",
  "bonjour12345",
  "bonjourbonjour",
  "basketball123",
  "basketball1234",
  "arbitre12345",
  "arbitrebasket",
  "football1234",
]);

/**
 * Vrai si le mot de passe n'est qu'un motif court répété
 * (`aaaaaaaaaaaa`, `abababababab`, `azertyazerty`…).
 */
function isRepeatedPattern(value: string): boolean {
  for (let unit = 1; unit <= value.length / 2; unit += 1) {
    if (value.length % unit === 0 && value === value.slice(0, unit).repeat(value.length / unit)) {
      return true;
    }
  }
  return false;
}

/** Vrai si le mot de passe est trivial (liste de mots courants ou motif répété). */
export function isTrivialPassword(password: string): boolean {
  const normalized = password.toLowerCase();
  return COMMON_PASSWORDS.has(normalized) || isRepeatedPattern(normalized);
}