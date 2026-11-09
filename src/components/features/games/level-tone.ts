/**
 * Couleur d'une échelle de note (de 1 à 5), bloc 10 (§3.12 : vert, jaune et rouge réservés
 * aux échelles et aux statuts). Une confiance, une gestion ou un jugement hauts sont bons ;
 * seul le stress s'inverse. Pur ; le chiffre reste toujours affiché (jamais la couleur seule).
 */
import type { NoteLevelField } from "@/lib/game-form-fields";

export type LevelKind = NoteLevelField;
export type LevelTone = "good" | "medium" | "bad";

export function levelTone(kind: LevelKind, value: number): LevelTone {
  const tone: LevelTone = value <= 2 ? "bad" : value === 3 ? "medium" : "good";
  if (kind !== "stress") {
    return tone;
  }
  return tone === "bad" ? "good" : tone === "good" ? "bad" : "medium";
}

/** Classes Tailwind du thème pour chaque ton (couleurs de `globals.css`). */
export const TONE_FILL: Record<LevelTone, string> = {
  good: "bg-success",
  medium: "bg-warning",
  bad: "bg-destructive",
};

export const TONE_BORDER: Record<LevelTone, string> = {
  good: "border-success",
  medium: "border-warning",
  bad: "border-destructive",
};
