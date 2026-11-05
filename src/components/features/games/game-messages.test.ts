import { describe, expect, it } from "vitest";
import {
  colleagueStatusMessage,
  noteFieldError,
  noteStatusMessage,
  officialsStatusMessage,
  slotError,
} from "./game-messages";

const INVALID_NOTE = {
  status: "invalid",
  fields: [],
  clipLines: [],
  tooManyClips: false,
  empty: false,
} as const;

describe("officialsStatusMessage", () => {
  it("n'affiche rien avant l'envoi ni après une création (redirection)", () => {
    expect(officialsStatusMessage({ status: "idle" })).toBeNull();
    expect(
      officialsStatusMessage({ status: "created", gameId: "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01" }),
    ).toBeNull();
  });

  it("confirme l'enregistrement", () => {
    expect(officialsStatusMessage({ status: "updated" })).toEqual({
      tone: "success",
      text: "Officiels enregistrés.",
    });
  });

  it("explique chaque refus", () => {
    expect(officialsStatusMessage({ status: "invalid", errors: {} })?.tone).toBe("error");
    expect(officialsStatusMessage({ status: "not_found", field: "compensation" })?.text).toContain(
      "indemnité",
    );
    expect(officialsStatusMessage({ status: "not_found", field: "game" })?.text).toContain("match");
    expect(officialsStatusMessage({ status: "not_found", field: "referee2" })?.text).toContain(
      "collègue",
    );
    expect(
      officialsStatusMessage({
        status: "already_linked",
        gameId: "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01",
      })?.text,
    ).toContain("déjà");
    expect(officialsStatusMessage({ status: "limit_reached", resource: "game" })?.text).toContain(
      "matchs",
    );
    expect(
      officialsStatusMessage({ status: "limit_reached", resource: "colleague" })?.text,
    ).toContain("collègues");
  });
});

describe("slotError", () => {
  it("traduit l'erreur de la place concernée seulement", () => {
    const state = { status: "invalid", errors: { observer: "self_twice" } } as const;
    expect(slotError("observer", state)).toBe("Vous ne pouvez occuper qu'une seule place.");
    expect(slotError("referee1", state)).toBeNull();
  });

  it("signale un collègue introuvable sur sa place", () => {
    expect(slotError("referee3", { status: "not_found", field: "referee3" })).toContain(
      "n'existe plus",
    );
    expect(slotError("referee1", { status: "updated" })).toBeNull();
  });
});

describe("noteStatusMessage", () => {
  it("couvre chaque état", () => {
    expect(noteStatusMessage({ status: "idle" })).toBeNull();
    expect(noteStatusMessage({ status: "saved" })?.tone).toBe("success");
    expect(noteStatusMessage(INVALID_NOTE)?.tone).toBe("error");
    expect(noteStatusMessage({ status: "not_found", field: "game" })?.text).toContain("match");
  });
});

describe("noteFieldError", () => {
  it("signale les niveaux et le texte invalides", () => {
    const state = { ...INVALID_NOTE, fields: ["stress", "body"] } as const;
    expect(noteFieldError("stress", state)).toContain("1 à 5");
    expect(noteFieldError("confidence", state)).toBeNull();
    expect(noteFieldError("body", state)).toContain("4 096");
  });

  it("place la note vide sous le texte", () => {
    expect(noteFieldError("body", { ...INVALID_NOTE, empty: true })).toBe(
      "Renseignez au moins un champ.",
    );
  });

  it("liste les lignes de liens refusées et le dépassement", () => {
    expect(
      noteFieldError("clips", { ...INVALID_NOTE, clipLines: [2, 4], tooManyClips: true }),
    ).toBe(
      "Lien invalide (ligne 2, 4) : seuls les liens http ou https sont acceptés. 10 liens maximum.",
    );
    expect(noteFieldError("clips", INVALID_NOTE)).toBeNull();
    expect(noteFieldError("clips", { status: "saved" })).toBeNull();
  });
});

describe("colleagueStatusMessage", () => {
  it("couvre chaque état", () => {
    expect(colleagueStatusMessage({ status: "idle" })).toBeNull();
    expect(colleagueStatusMessage({ status: "created" })?.tone).toBe("success");
    expect(colleagueStatusMessage({ status: "updated" })?.tone).toBe("success");
    expect(colleagueStatusMessage({ status: "invalid" })?.tone).toBe("error");
    expect(colleagueStatusMessage({ status: "not_found" })?.tone).toBe("error");
    expect(colleagueStatusMessage({ status: "limit_reached" })?.text).toContain("collègues");
  });
});
