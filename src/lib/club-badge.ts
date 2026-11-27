/**
 * Pastille d'un club : son logo FFBB sur sa couleur, ou à défaut ses initiales. Fonctions
 * pures, partagées par les cartes (indemnités, puis notes et préparations si l'essai est
 * concluant).
 */

/** Petits mots ignorés dans les initiales (« US de la Vallée » → « UV »). */
const SKIPPED_WORDS = new Set([
  "DE",
  "DU",
  "DES",
  "LA",
  "LE",
  "LES",
  "L",
  "D",
  "ET",
  "EN",
  "SUR",
  "SOUS",
  "AU",
  "AUX",
]);

/**
 * Deux initiales au plus : la première lettre (ou chiffre) des deux premiers mots
 * significatifs, ou les deux premières d'un nom d'un seul mot. Un mot composé
 * (« SAINT-FLOUR ») compte pour un. « BC BÉTHUNE » → « BB », « ASPTT » → « AS ».
 */
export function clubInitials(name: string): string {
  const words = name
    .toLocaleUpperCase("fr-FR")
    .split(/[\s'’]+/u)
    .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, "").replace(/^-+/, ""))
    .filter((word) => word !== "");
  const significant = words.filter((word) => !SKIPPED_WORDS.has(word));
  const kept = significant.length > 0 ? significant : words;
  const [first = "", second] = kept;
  const initials =
    second === undefined
      ? Array.from(first.replace(/-/g, "")).slice(0, 2).join("")
      : `${Array.from(first)[0] ?? ""}${Array.from(second)[0] ?? ""}`;
  return initials === "" ? "?" : initials;
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Luminance relative WCAG 2 d'une couleur `#rrggbb` ; `null` si elle est mal formée. */
export function relativeLuminance(color: string): number | null {
  const match = HEX_COLOR.exec(color);
  if (match === null) {
    return null;
  }
  const [r = 0, g = 0, b = 0] = match.slice(1).map((hex) => {
    const channel = parseInt(hex, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Texte lisible sur la couleur du club : clair ou sombre, celui qui contraste le plus.
 * `null` sans couleur exploitable (la pastille garde alors les couleurs du thème).
 */
export function initialsTone(color: string | null): "light" | "dark" | null {
  const luminance = color === null ? null : relativeLuminance(color);
  if (luminance === null) {
    return null;
  }
  // Contraste avec le blanc (1) et avec le noir (0) : on garde le plus élevé.
  const withWhite = 1.05 / (luminance + 0.05);
  const withBlack = (luminance + 0.05) / 0.05;
  return withWhite >= withBlack ? "light" : "dark";
}
