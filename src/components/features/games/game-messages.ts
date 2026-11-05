/**
 * Traduit les états des formulaires de match complet (officiels, note, collègues) en
 * messages affichables. Pur et sans React : testé à part.
 */
import { fr } from "@/i18n/fr";
import type { OfficialSlot } from "@/lib/schemas/officials";
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import type { CompensationFormState } from "@/server/compensation/compensation-form";
import type { ColleagueFormState } from "@/server/games/colleagues-form";
import type { GameFormState } from "@/server/games/game-info-form";
import type { NoteField, NoteFormState } from "@/server/games/note-form";
import type { OfficialsFormState } from "@/server/games/officials-form";

const t = fr.games;

/** Message global du formulaire des officiels ; les erreurs de place sont sous chaque place. */
export function officialsStatusMessage(state: OfficialsFormState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
    case "created":
      return null;
    case "updated":
      return { tone: "success", text: t.officials.updated };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "not_found":
      if (state.field === "compensation") {
        return { tone: "error", text: t.errors.compensationNotFound };
      }
      return {
        tone: "error",
        text: state.field === "game" ? t.errors.gameNotFound : t.errors.notFoundSlot,
      };
    case "already_linked":
      return { tone: "error", text: t.errors.alreadyLinked };
    case "no_rate_at_date":
      return { tone: "error", text: t.errors.noRateAtDate };
    case "limit_reached":
      return { tone: "error", text: limitMessage(state.resource) };
  }
}

function limitMessage(resource: "game" | "colleague" | "club"): string {
  switch (resource) {
    case "game":
      return t.errors.gameLimit;
    case "colleague":
      return t.errors.colleagueLimit;
    case "club":
      return fr.compensations.errors.clubLimit;
  }
}

/** Erreur d'une place précise, ou `null`. */
export function slotError(slot: OfficialSlot, state: OfficialsFormState): string | null {
  if (state.status === "invalid") {
    const code = state.errors[slot];
    return code === undefined ? null : t.errors[code];
  }
  if (state.status === "not_found" && state.field === slot) {
    return t.errors.notFoundSlot;
  }
  return null;
}

export function noteStatusMessage(state: NoteFormState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "saved":
      return { tone: "success", text: t.note.saved };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "not_found":
      return { tone: "error", text: t.errors.gameNotFound };
  }
}

/** Erreur d'un champ de la note, ou `null`. */
export function noteFieldError(field: NoteField | "clips", state: NoteFormState): string | null {
  if (state.status !== "invalid") {
    return null;
  }
  switch (field) {
    case "confidence":
    case "stress":
      return state.fields.includes(field) ? t.errors.level : null;
    case "body":
      if (state.fields.includes("body")) {
        return t.errors.body;
      }
      return state.empty ? t.errors.emptyNote : null;
    case "clips": {
      const messages: string[] = [];
      if (state.clipLines.length > 0) {
        messages.push(t.errors.clipLines.replace("{lines}", state.clipLines.join(", ")));
      }
      if (state.tooManyClips) {
        messages.push(t.errors.tooManyClips);
      }
      return messages.length === 0 ? null : messages.join(" ");
    }
  }
}

export function colleagueStatusMessage(state: ColleagueFormState): ScaleMessage | null {
  const c = fr.colleagues;
  switch (state.status) {
    case "idle":
      return null;
    case "created":
      return { tone: "success", text: c.add.created };
    case "updated":
      return { tone: "success", text: c.edit.updated };
    case "invalid":
      return { tone: "error", text: c.errors.invalid };
    case "not_found":
      return { tone: "error", text: c.errors.notFound };
    case "limit_reached":
      return { tone: "error", text: c.errors.limit };
  }
}

/** Message global du formulaire de match (sans indemnité, ou informations modifiées). */
export function gameFormStatusMessage(state: GameFormState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
    case "created":
      return null;
    case "updated":
      return { tone: "success", text: t.info.updated };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "no_rate_at_date":
      return { tone: "error", text: t.errors.noRateAtDate };
    case "limit_reached":
      return { tone: "error", text: limitMessage(state.resource) };
    case "not_found":
      switch (state.field) {
        case "divisionId":
        case "team1":
        case "team2":
        case "venue":
          return { tone: "error", text: fr.compensations.errors.notFound };
        default:
          return officialsStatusMessage({ status: "not_found", field: state.field });
      }
    case "already_linked":
      return officialsStatusMessage(state);
  }
}

/** État vu par les champs du match (partagés avec l'indemnité) : erreurs de champ seulement. */
export function matchFieldsState(state: GameFormState): CompensationFormState {
  if (state.status === "invalid") {
    return { status: "invalid", fields: state.fields };
  }
  if (state.status === "not_found") {
    switch (state.field) {
      case "divisionId":
      case "team1":
      case "team2":
      case "venue":
        return { status: "not_found", field: state.field };
      default:
        return { status: "idle" };
    }
  }
  return { status: "idle" };
}

/** État vu par les places des officiels : erreurs de place seulement. */
export function officialsFieldState(state: GameFormState): OfficialsFormState {
  if (state.status === "invalid") {
    return { status: "invalid", errors: state.officials };
  }
  if (state.status === "not_found") {
    switch (state.field) {
      case "referee1":
      case "referee2":
      case "referee3":
      case "observer":
        return { status: "not_found", field: state.field };
      default:
        return { status: "idle" };
    }
  }
  return { status: "idle" };
}
