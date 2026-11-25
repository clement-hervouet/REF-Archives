/**
 * Tailles de texte de l'éditeur riche, du plus petit au plus gros : « + gros » et « − gros »
 * avancent d'un cran dans cette échelle. Pur et sans dépendance : testé à part.
 */
import type { HeadingLevel } from "./extensions";

const TEXT_SIZES = ["small", "normal", "h3", "h2", "h1"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Taille voisine (`step` = +1 plus gros, −1 plus petit), ou `null` au bout de l'échelle. */
export function nextTextSize(current: TextSize, step: 1 | -1): TextSize | null {
  return TEXT_SIZES[TEXT_SIZES.indexOf(current) + step] ?? null;
}

/** Niveau de titre d'une taille, ou `null` pour le petit texte et le texte normal. */
export function headingLevelOf(size: TextSize): HeadingLevel | null {
  switch (size) {
    case "h1":
      return 1;
    case "h2":
      return 2;
    case "h3":
      return 3;
    default:
      return null;
  }
}
