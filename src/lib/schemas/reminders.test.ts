import { describe, expect, it } from "vitest";
import { parseReminderSettingsForm } from "./reminders";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value);
  }
  return data;
}

describe("parseReminderSettingsForm", () => {
  it("lit les cases cochées et le délai", () => {
    expect(
      parseReminderSettingsForm(
        form({
          availabilityReminderEnabled: "on",
          availabilityReminderWeeks: "5",
          weekendRecapEnabled: "on",
        }),
      ),
    ).toEqual({
      availabilityReminderEnabled: true,
      availabilityReminderWeeks: 5,
      weekendRecapEnabled: true,
    });
  });

  it("traite une case absente comme décochée", () => {
    expect(parseReminderSettingsForm(form({ availabilityReminderWeeks: "12" }))).toEqual({
      availabilityReminderEnabled: false,
      availabilityReminderWeeks: 12,
      weekendRecapEnabled: false,
    });
  });

  it("accepte les bornes 1 et 12", () => {
    expect(parseReminderSettingsForm(form({ availabilityReminderWeeks: "1" }))).not.toBeNull();
    expect(parseReminderSettingsForm(form({ availabilityReminderWeeks: "12" }))).not.toBeNull();
  });

  it("refuse un délai hors bornes, décimal ou absent", () => {
    for (const weeks of ["0", "13", "5.5", "-1", "abc", ""]) {
      expect(parseReminderSettingsForm(form({ availabilityReminderWeeks: weeks })), weeks).toBeNull();
    }
    expect(parseReminderSettingsForm(form({}))).toBeNull();
  });

  it("refuse une valeur de case inattendue", () => {
    expect(
      parseReminderSettingsForm(
        form({ availabilityReminderEnabled: "true", availabilityReminderWeeks: "5" }),
      ),
    ).toBeNull();
  });
});
