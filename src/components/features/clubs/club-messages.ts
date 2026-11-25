/**
 * Messages des formulaires de l'onglet « Clubs » (§15.4.1). Pur et sans React : testé à part.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import type { ClubField } from "@/lib/schemas/clubs";
import type { ClubFormState, ClubVenueField, ClubVenueState } from "@/server/clubs/manage-clubs";

const t = fr.clubs;
const v = fr.clubs.venues;

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
    case "venueName":
      return t.errors.venueName;
    case "venues":
      return t.errors.venues;
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

/** Résultat d'une action sur les salles d'un club. */
export function clubVenueStatusMessage(state: ClubVenueState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "added":
      return {
        tone: "success",
        text: state.count === 1 ? v.addedOne : v.addedMany.replace("{count}", String(state.count)),
      };
    case "removed":
      return { tone: "success", text: v.removed };
    case "main_set":
      return { tone: "success", text: v.mainSet };
    case "unchanged":
      return { tone: "error", text: v.unchanged };
    case "full":
      return { tone: "error", text: v.full };
    case "invalid":
      return {
        tone: "error",
        text: state.fields.includes("venues") ? t.errors.venues : t.errors.invalid,
      };
    case "not_found":
      return { tone: "error", text: t.errors.notFound };
  }
}

/** Erreur d'un champ de la salle saisie à la main, ou `null`. */
export function clubVenueFieldError(field: ClubVenueField, state: ClubVenueState): string | null {
  if (state.status !== "invalid" || !state.fields.includes(field)) {
    return null;
  }
  switch (field) {
    case "name":
      return t.errors.venueName;
    case "street":
      return t.errors.street;
    case "city":
      return t.errors.city;
    case "venues":
      return t.errors.venues;
    case "number":
    case "postalCode":
      return fr.compensations.errors[field];
  }
}
