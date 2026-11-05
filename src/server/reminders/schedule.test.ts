import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVAILABILITY_REMINDER_WEEKS,
  type ReminderSettings,
  availabilityTargetSaturday,
  dueReminders,
} from "./schedule";

const ALL_ON: ReminderSettings = {
  availabilityReminderEnabled: true,
  availabilityReminderWeeks: DEFAULT_AVAILABILITY_REMINDER_WEEKS,
  weekendRecapEnabled: true,
};

describe("availabilityTargetSaturday", () => {
  it("vise le samedi de la semaine située N semaines plus loin", () => {
    // Lundi 02/11/2026 + 5 semaines = semaine du 07/12, samedi 12/12.
    expect(availabilityTargetSaturday("2026-11-02", 5)).toBe("2026-12-12");
  });

  it("donne la même cible quel que soit le jour de la semaine d'envoi", () => {
    expect(availabilityTargetSaturday("2026-11-05", 5)).toBe("2026-12-12");
    expect(availabilityTargetSaturday("2026-11-08", 5)).toBe("2026-12-12");
  });

  it("traverse le changement d'année", () => {
    expect(availabilityTargetSaturday("2026-12-14", 3)).toBe("2027-01-09");
  });
});

describe("dueReminders", () => {
  it("le lundi : seulement le rappel des indisponibilités", () => {
    expect(dueReminders("2026-11-02", ALL_ON)).toEqual([
      { kind: "availability", periodStart: "2026-11-02", weekendSaturday: "2026-12-12" },
    ]);
  });

  it("du jeudi au samedi : aussi le récapitulatif du weekend", () => {
    for (const today of ["2026-11-05", "2026-11-06", "2026-11-07"]) {
      expect(dueReminders(today, ALL_ON), today).toEqual([
        { kind: "availability", periodStart: "2026-11-02", weekendSaturday: "2026-12-12" },
        { kind: "weekend_recap", periodStart: "2026-11-07" },
      ]);
    }
  });

  it("pas de récapitulatif le dimanche ni le mercredi", () => {
    for (const today of ["2026-11-04", "2026-11-08"]) {
      expect(
        dueReminders(today, ALL_ON).map((reminder) => reminder.kind),
        today,
      ).toEqual(["availability"]);
    }
  });

  it("garde la même période toute la semaine (un seul rappel par semaine)", () => {
    const periods = ["2026-11-02", "2026-11-04", "2026-11-08"].map(
      (today) => dueReminders(today, ALL_ON)[0]?.periodStart,
    );
    expect(periods).toEqual(["2026-11-02", "2026-11-02", "2026-11-02"]);
  });

  it("respecte le délai choisi par l'utilisateur", () => {
    expect(dueReminders("2026-11-02", { ...ALL_ON, availabilityReminderWeeks: 2 })).toEqual([
      { kind: "availability", periodStart: "2026-11-02", weekendSaturday: "2026-11-21" },
    ]);
  });

  it("n'envoie rien de ce qui est désactivé", () => {
    const noneEnabled = {
      ...ALL_ON,
      availabilityReminderEnabled: false,
      weekendRecapEnabled: false,
    };
    expect(dueReminders("2026-11-05", noneEnabled)).toEqual([]);
    expect(
      dueReminders("2026-11-05", { ...ALL_ON, availabilityReminderEnabled: false }),
    ).toEqual([{ kind: "weekend_recap", periodStart: "2026-11-07" }]);
  });
});
