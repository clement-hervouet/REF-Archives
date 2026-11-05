/**
 * Résumé des officiels d'un match sur une ligne, dans l'ordre officiel, ex.
 * « Arbitre 1 : Alex Martin · Arbitre 2 : Moi · Observateur : Durand ». Pur : utilisé par
 * la page « À venir » et par l'email du récapitulatif.
 */
import { fr } from "@/i18n/fr";
import type { OfficialSlot } from "@/lib/game-form-fields";
import { personLabel } from "./person-label";

export type OfficialName = {
  slot: OfficialSlot;
  isSelf: boolean;
  firstname: string | null;
  lastname: string | null;
};

/** `null` sans officiel (indemnité sans match complet). */
export function officialsSummary(officials: readonly OfficialName[]): string | null {
  if (officials.length === 0) {
    return null;
  }
  return officials
    .map((official) =>
      fr.games.summary.item
        .replace("{slot}", fr.games.slots[official.slot])
        .replace("{name}", personLabel(official)),
    )
    .join(fr.games.summary.separator);
}
