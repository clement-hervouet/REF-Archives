import { describe, expect, it } from "vitest";
import { acknowledgementWeek, availabilityReminderState } from "./availability-reminder";

const ON = { availabilityReminderEnabled: true, availabilityReminderWeeks: 5 };
const OFF = { availabilityReminderEnabled: false, availabilityReminderWeeks: 5 };

describe("acknowledgementWeek", () => {
  it("renvoie le lundi de la semaine, quel que soit le jour", () => {
    expect(acknowledgementWeek("2026-11-02")).toBe("2026-11-02"); // lundi
    expect(acknowledgementWeek("2026-11-06")).toBe("2026-11-02"); // vendredi
    expect(acknowledgementWeek("2026-11-08")).toBe("2026-11-02"); // dimanche
  });
});

describe("availabilityReminderState", () => {
  it("masque le rappel quand il est désactivé, même sans validation", () => {
    expect(availabilityReminderState(OFF, null, "2026-11-06")).toEqual({ kind: "hidden" });
  });

  it("affiche le rappel à faire, pour le weekend situé N semaines plus loin", () => {
    // Semaine du lundi 02/11 + 5 semaines → samedi 12/12 (même règle que l'email).
    expect(availabilityReminderState(ON, null, "2026-11-06")).toEqual({
      kind: "due",
      saturday: "2026-12-12",
    });
  });

  it("le marque validé toute la semaine de la validation", () => {
    for (const today of ["2026-11-02", "2026-11-05", "2026-11-08"]) {
      expect(availabilityReminderState(ON, "2026-11-02", today).kind).toBe("acknowledged");
    }
  });

  it("le fait revenir dès le lundi suivant", () => {
    expect(availabilityReminderState(ON, "2026-11-02", "2026-11-09")).toEqual({
      kind: "due",
      saturday: "2026-12-19",
    });
  });
});
