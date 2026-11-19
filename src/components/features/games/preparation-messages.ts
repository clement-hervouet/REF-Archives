/**
 * Traduit les états du formulaire de préparation de match (§15.4.10) en messages
 * affichables, et met en forme le classement d'une équipe. Pur et sans React : testé à part.
 */
import { fr } from "@/i18n/fr";
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import type { PreparationFormState } from "@/server/games/preparation-form";

const t = fr.preparations;

export function preparationStatusMessage(state: PreparationFormState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "saved":
      return { tone: "success", text: t.form.saved };
    case "invalid":
      return { tone: "error", text: state.empty ? t.errors.empty : t.errors.invalid };
    case "not_found":
      return { tone: "error", text: t.errors.gameNotFound };
    case "plateau":
      return { tone: "error", text: t.errors.plateau };
  }
}

/** Message d'un champ numérique invalide, selon sa partie (`team1Rank` → position). */
function numberError(field: string): string {
  if (field === "teamCount") return t.errors.teamCount;
  if (field.endsWith("Rank")) return t.errors.rank;
  if (field.endsWith("Wins") || field.endsWith("Losses")) return t.errors.record;
  return t.errors.text;
}

/** Erreur d'un champ (nom HTML : `team1Rank`, `placement`…), ou `null`. */
export function preparationFieldError(field: string, state: PreparationFormState): string | null {
  if (state.status !== "invalid") {
    return null;
  }
  const issue = state.fields[field];
  if (issue === undefined) {
    return null;
  }
  return issue === "rank_above_count" ? t.errors.rankAboveCount : numberError(field);
}

/**
 * Classement d'une équipe en abrégé (« 3e sur 12, 7 V – 2 D »), ou `null` s'il est vide.
 * `teamCount` : nombre d'équipes de la poule, commun aux deux équipes.
 */
export function standingText(
  standing: { rank: number | null; wins: number | null; losses: number | null },
  teamCount: number | null,
): string | null {
  const parts: string[] = [];
  if (standing.rank !== null) {
    const ordinal =
      standing.rank === 1 ? t.ordinalFirst : t.ordinal.replace("{rank}", String(standing.rank));
    parts.push(
      teamCount === null
        ? ordinal
        : t.rankOf.replace("{ordinal}", ordinal).replace("{count}", String(teamCount)),
    );
  }
  if (standing.wins !== null || standing.losses !== null) {
    parts.push(
      t.record
        .replace("{wins}", String(standing.wins ?? 0))
        .replace("{losses}", String(standing.losses ?? 0)),
    );
  }
  return parts.length === 0 ? null : parts.join(t.standingSeparator);
}
