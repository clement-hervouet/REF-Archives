/**
 * Traduit l'état du formulaire « Nouvelle indemnité » en messages affichables.
 * Pur et sans React : testé à part.
 */
import { fr } from "@/i18n/fr";
import { formatCents } from "@/lib/format";
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
    case "date":
    case "time":
    case "divisionId":
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
