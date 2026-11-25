/**
 * Traduit l'état du formulaire « Nouvelle indemnité » en messages affichables.
 * Pur et sans React : testé à part.
 */
import { fr } from "@/i18n/fr";
import { divisionAbbreviation } from "@/components/features/scales/division-label";
import { formatCents } from "@/lib/format";
import { seasonLabel } from "@/lib/seasons";
import type { CompensationField } from "@/lib/compensation-form-fields";
import type { CompensationFormState } from "@/server/compensation/compensation-form";

const t = fr.compensations;

export type CompensationMessage = { tone: "error" | "success"; text: string };

/** Message global ; les erreurs de champ sont affichées sous chaque champ (`fieldError`). */
export function compensationStatusMessage(
  state: CompensationFormState,
): CompensationMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "created":
    case "updated":
      return {
        tone: "success",
        text: (state.status === "created" ? t.new.created : t.edit.updated)
          .replace("{total}", formatCents(state.amount.totalCents))
          .replace("{game}", formatCents(state.amount.gameCents))
          .replace("{mileage}", formatCents(state.amount.mileageCents)),
      };
    case "not_found":
      return {
        tone: "error",
        text: state.field === "compensation" ? t.errors.compensationNotFound : t.errors.notFound,
      };
    case "no_rate_at_date":
      return { tone: "error", text: t.errors.noRateAtDate };
    case "limit_reached":
      return {
        tone: "error",
        text: state.resource === "club" ? t.errors.clubLimit : t.errors.compensationLimit,
      };
  }
}

/** Partie d'un champ composé : `team1.city` → `city`. */
function part(field: CompensationField): string {
  return field.slice(field.indexOf(".") + 1);
}

/** Message d'erreur d'un champ précis, ou `null` s'il est valide. */
export function fieldError(field: CompensationField, state: CompensationFormState): string | null {
  // Un refus « introuvable » désigne aussi le champ concerné, pour y amener l'attention.
  const failed =
    state.status === "invalid"
      ? state.fields.includes(field)
      : state.status === "not_found" && state.field === field;
  if (!failed) {
    return null;
  }
  switch (field) {
    case "team1":
    case "team2":
      return t.errors.team;
    case "team1.name":
    case "team2.name":
      return t.errors.name;
    case "venue.name":
      return t.errors.venueName;
    case "date":
    case "time":
    case "divisionId":
    case "cupRound":
    case "gameCount":
    case "plateauGameAmount":
    case "scaleId":
    case "payer":
    case "venue":
    case "oneWayDistance":
      return t.errors[field];
    default: {
      const address = part(field);
      return address === "street" ||
        address === "number" ||
        address === "postalCode" ||
        address === "city" ||
        address === "country"
        ? t.errors[address]
        : t.errors.invalid;
    }
  }
}

/**
 * Messages de célébration après un enregistrement réussi (confettis) : première indemnité
 * d'une saison FFBB (bloc 12d), finale de coupe tout juste enregistrée (§15.4.6, nommée
 * d'après le lieu du match : « CBU18F »). Vide : pas de célébration.
 */
export function celebrationMessages(state: CompensationFormState): string[] {
  if (state.status !== "created" && state.status !== "updated") {
    return [];
  }
  const messages: string[] = [];
  if (state.status === "created" && state.firstOfSeason !== null) {
    messages.push(t.new.seasonStart.replace("{season}", seasonLabel(state.firstOfSeason)));
  }
  if (state.final !== null) {
    messages.push(
      t.new.finalReached.replace(
        "{cup}",
        divisionAbbreviation(state.final, state.final.department),
      ),
    );
  }
  return messages;
}

/**
 * Montant des matchs dans un détail (« match {game} ») : le montant seul, ou pour un
 * plateau (§15.4.7) le total détaillé « 90,00 € (3 × 30,00 €) ».
 */
export function gamesAmountText(gameCents: number, gameCount: number): string {
  if (gameCount <= 1) {
    return formatCents(gameCents);
  }
  return t.recap.plateauGames
    .replace("{total}", formatCents(gameCents))
    .replace("{count}", String(gameCount))
    .replace("{unit}", formatCents(Math.round(gameCents / gameCount)));
}
