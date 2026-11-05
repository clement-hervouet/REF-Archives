import { describe, expect, it, vi } from "vitest";
import { type ReminderSettingsDeps, handleUpdateReminderSettings } from "./settings";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";

function validForm(): FormData {
  const data = new FormData();
  data.set("availabilityReminderEnabled", "on");
  data.set("availabilityReminderWeeks", "3");
  return data;
}

describe("handleUpdateReminderSettings", () => {
  it("enregistre les réglages de l'utilisateur de la session", async () => {
    const update = vi.fn<ReminderSettingsDeps["update"]>(() => Promise.resolve(true));
    expect(await handleUpdateReminderSettings({ update }, USER_ID, validForm())).toEqual({
      status: "saved",
    });
    expect(update).toHaveBeenCalledWith(USER_ID, {
      availabilityReminderEnabled: true,
      availabilityReminderWeeks: 3,
      weekendRecapEnabled: false,
    });
  });

  it("ignore un identifiant d'utilisateur glissé dans le formulaire", async () => {
    const update = vi.fn<ReminderSettingsDeps["update"]>(() => Promise.resolve(true));
    const data = validForm();
    data.set("userId", "5b1e8a07-3c44-4d9b-8f12-7a6d0c9e2f44");
    await handleUpdateReminderSettings({ update }, USER_ID, data);
    expect(update.mock.lastCall?.[0]).toBe(USER_ID);
  });

  it("refuse un formulaire invalide sans écrire en base", async () => {
    const update = vi.fn(() => Promise.resolve(true));
    const data = validForm();
    data.set("availabilityReminderWeeks", "99");
    expect(await handleUpdateReminderSettings({ update }, USER_ID, data)).toEqual({
      status: "invalid",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("signale un compte introuvable", async () => {
    const update = vi.fn(() => Promise.resolve(false));
    expect(await handleUpdateReminderSettings({ update }, USER_ID, validForm())).toEqual({
      status: "not_found",
    });
  });
});