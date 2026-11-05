import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { makeFakeDb } from "./fake-db";
import {
  REMINDER_RECIPIENTS_PAGE_SIZE,
  claimReminderDispatch,
  getReminderSettings,
  listReminderRecipients,
  releaseReminderDispatch,
  updateReminderSettings,
} from "./reminders";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const OTHER_USER_ID = "5b1e8a07-3c44-4d9b-8f12-7a6d0c9e2f44";

const SETTINGS_ROW = {
  availability_reminder_enabled: true,
  availability_reminder_weeks: 5,
  weekend_recap_enabled: false,
};

const SETTINGS = {
  availabilityReminderEnabled: true,
  availabilityReminderWeeks: 5,
  weekendRecapEnabled: false,
};

describe("getReminderSettings", () => {
  it("renvoie les réglages de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([SETTINGS_ROW]);
    expect(await getReminderSettings(db, USER_ID)).toEqual(SETTINGS);
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID]);
  });

  it("renvoie null pour un compte inconnu", async () => {
    const { db } = makeFakeDb();
    expect(await getReminderSettings(db, USER_ID)).toBeNull();
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([{ ...SETTINGS_ROW, availability_reminder_weeks: "5" }]);
    await expect(getReminderSettings(db, USER_ID)).rejects.toThrow();
  });
});

describe("updateReminderSettings", () => {
  it("passe les réglages en paramètres, dans l'ordre de la requête", async () => {
    const { db, query } = makeFakeDb([{ id: USER_ID }]);
    expect(await updateReminderSettings(db, USER_ID, SETTINGS)).toBe(true);
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID, true, 5, false]);
  });

  it("renvoie false si le compte n'existe pas", async () => {
    const { db } = makeFakeDb();
    expect(await updateReminderSettings(db, USER_ID, SETTINGS)).toBe(false);
  });
});

describe("listReminderRecipients", () => {
  it("renvoie les destinataires avec leurs réglages", async () => {
    const { db } = makeFakeDb([{ ...SETTINGS_ROW, id: USER_ID, email: "clem@example.com" }]);
    expect(await listReminderRecipients(db, { afterUserId: null })).toEqual([
      { userId: USER_ID, email: "clem@example.com", settings: SETTINGS },
    ]);
  });

  it("pagine par id avec la taille de page par défaut", async () => {
    const { db, query } = makeFakeDb();
    await listReminderRecipients(db, { afterUserId: OTHER_USER_ID });
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("ORDER BY id");
    expect(call?.[1]).toEqual([OTHER_USER_ID, REMINDER_RECIPIENTS_PAGE_SIZE]);
  });

  it("n'interroge que les comptes ayant au moins un rappel activé", async () => {
    const { db, query } = makeFakeDb();
    await listReminderRecipients(db, { afterUserId: null, limit: 10 });
    expect(query.mock.lastCall?.[0]).toContain(
      "availability_reminder_enabled OR weekend_recap_enabled",
    );
    expect(query.mock.lastCall?.[1]).toEqual([null, 10]);
  });
});

describe("claimReminderDispatch", () => {
  const key = { userId: USER_ID, kind: "availability", periodStart: "2026-11-02" } as const;

  it("renvoie true quand la réservation est créée", async () => {
    const { db, query } = makeFakeDb([{ user_id: USER_ID }]);
    expect(await claimReminderDispatch(db, key)).toBe(true);
    expect(query.mock.lastCall?.[0]).toContain("ON CONFLICT");
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID, "availability", "2026-11-02"]);
  });

  it("renvoie false quand l'envoi est déjà réservé", async () => {
    const { db } = makeFakeDb();
    expect(await claimReminderDispatch(db, key)).toBe(false);
  });

  it("refuse une période qui n'est pas une date", async () => {
    const { db, query } = makeFakeDb();
    await expect(claimReminderDispatch(db, { ...key, periodStart: "2026-11-31" })).rejects.toThrow(
      ValidationError,
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe("releaseReminderDispatch", () => {
  it("supprime la réservation correspondante", async () => {
    const { db, query } = makeFakeDb();
    await releaseReminderDispatch(db, {
      userId: USER_ID,
      kind: "weekend_recap",
      periodStart: "2026-11-07",
    });
    expect(query.mock.lastCall?.[0]).toContain("DELETE FROM reminder_dispatch");
    expect(query.mock.lastCall?.[1]).toEqual([USER_ID, "weekend_recap", "2026-11-07"]);
  });
});
