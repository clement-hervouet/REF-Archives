/**
 * Messages des formulaires de l'onglet « Clubs » (§15.4.1). Pur et sans React : testé à part.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import type { ClubField } from "@/lib/schemas/clubs";
import type { ClubFormState } from "@/server/clubs/manage-clubs";

const t = fr.clubs;

export function clubStatusMessage(state: ClubFormState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "created":
      return { tone: "success", text: t.add.created };
    case "updated":
      return { tone: "success", text: t.edit.updated };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "not_found":
      return { tone: "error", text: t.errors.notFound };
    case "limit_reached":
      return { tone: "error", text: fr.compensations.errors.clubLimit };
  }
}

/** Erreur d'un champ, ou `null` (mêmes messages que le formulaire d'indemnité). */
export function clubFieldError(field: ClubField, state: ClubFormState): string | null {
  if (state.status !== "invalid" || !state.fields.includes(field)) {
    return null;
  }
  switch (field) {
    case "street":
      return t.errors.street;
    case "city":
      return t.errors.city;
    case "name":
    case "number":
    case "postalCode":
    case "country":
      return fr.compensations.errors[field];
  }
}
