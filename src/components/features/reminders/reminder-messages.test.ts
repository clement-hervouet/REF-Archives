import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { reminderSettingsMessage, weeksOptionLabel } from "./reminder-messages";

const t = fr.reminders.settings;

describe("reminderSettingsMessage", () => {
  it("n'affiche rien au repos", () => {
    expect(reminderSettingsMessage("idle")).toBeNull();
  });

  it("confirme l'enregistrement", () => {
    expect(reminderSettingsMessage("saved")).toEqual({ tone: "success", text: t.saved });
  });

  it("signale les erreurs", () => {
    expect(reminderSettingsMessage("invalid")).toEqual({ tone: "error", text: t.errors.invalid });
    expect(reminderSettingsMessage("not_found")).toEqual({
      tone: "error",
      text: t.errors.notFound,
    });
  });
});

describe("weeksOptionLabel", () => {
  it("accorde au singulier et au pluriel", () => {
    expect(weeksOptionLabel(1)).toBe("1 semaine à l'avance");
    expect(weeksOptionLabel(5)).toBe("5 semaines à l'avance");
  });
});
