import { describe, expect, it, vi } from "vitest";
import { EmailDeliveryError } from "@/lib/errors";
import type { EmailMessage } from "@/lib/schemas/email";
import {
  REMINDER_RECIPIENTS_PAGE_SIZE,
  type ReminderDispatchKey,
  type ReminderRecipient,
} from "@/server/db/reminders";
import type { WeekendMatch } from "@/server/email/weekend-recap-email";
import { type RunRemindersDeps, processReminder, runReminders } from "./run-reminders";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";

// Jeudi 05/11/2026 à 08:00 à Paris : rappel des indisponibilités ET récapitulatif dus.
const THURSDAY = new Date("2026-11-05T07:00:00Z");
// Lundi 02/11/2026 à 08:00 à Paris : seulement le rappel des indisponibilités.
const MONDAY = new Date("2026-11-02T07:00:00Z");

const recipient: ReminderRecipient = {
  userId: USER_ID,
  email: "clem@example.com",
  settings: {
    availabilityReminderEnabled: true,
    availabilityReminderWeeks: 5,
    weekendRecapEnabled: true,
  },
};

const match: WeekendMatch = {
  startsAt: new Date("2026-11-07T19:30:00Z"),
  team1Name: "BC Béthune",
  team2Name: "ES Lens",
  division: { category: "Regional", type: "Feminin", level: "U15" },
  address: { street: "Rue du Stade", number: "2", postalCode: "62400", city: "Béthune" },
};

function makeDeps(overrides: Partial<RunRemindersDeps> = {}) {
  const sent: EmailMessage[] = [];
  const claimed = new Set<string>();
  const keyOf = (key: ReminderDispatchKey): string =>
    `${key.userId}|${key.kind}|${key.periodStart}`;
  const deps: RunRemindersDeps = {
    listRecipients: vi.fn((afterUserId: string | null) =>
      Promise.resolve(afterUserId === null ? [recipient] : []),
    ),
    claim: vi.fn((key: ReminderDispatchKey) => {
      if (claimed.has(keyOf(key))) return Promise.resolve(false);
      claimed.add(keyOf(key));
      return Promise.resolve(true);
    }),
    release: vi.fn((key: ReminderDispatchKey) => {
      claimed.delete(keyOf(key));
      return Promise.resolve();
    }),
    listWeekendMatches: vi.fn(() => Promise.resolve([match])),
    send: vi.fn((message: EmailMessage) => {
      sent.push(message);
      return Promise.resolve();
    }),
    appUrl: "https://ref.example.com",
    onError: vi.fn(),
    ...overrides,
  };
  return { deps, sent, claimed };
}

describe("runReminders", () => {
  it("le jeudi : envoie le rappel des indisponibilités et le récapitulatif", async () => {
    const { deps, sent } = makeDeps();
    expect(await runReminders(deps, THURSDAY)).toEqual({
      sent: 2,
      alreadySent: 0,
      nothingToSend: 0,
      failed: 0,
    });
    expect(sent.map((message) => message.subject)).toEqual([
      "Saisissez vos indisponibilités du weekend du 12/12",
      "Vos matchs du weekend du 07/11",
    ]);
  });

  it("le lundi : seulement le rappel des indisponibilités", async () => {
    const { deps, sent } = makeDeps();
    await runReminders(deps, MONDAY);
    expect(sent).toHaveLength(1);
    expect(deps.listWeekendMatches).not.toHaveBeenCalled();
  });

  it("n'envoie jamais deux fois le même rappel (deuxième passage le même jour)", async () => {
    const { deps, sent } = makeDeps();
    await runReminders(deps, THURSDAY);
    expect(await runReminders(deps, THURSDAY)).toEqual({
      sent: 0,
      alreadySent: 2,
      nothingToSend: 0,
      failed: 0,
    });
    expect(sent).toHaveLength(2);
  });

  it("cherche les matchs du vendredi 00:00 au lundi 00:00 à Paris", async () => {
    const { deps } = makeDeps();
    await runReminders(deps, THURSDAY);
    expect(deps.listWeekendMatches).toHaveBeenCalledWith({
      userId: USER_ID,
      from: new Date("2026-11-05T23:00:00.000Z"),
      to: new Date("2026-11-08T23:00:00.000Z"),
    });
  });

  it("n'envoie ni ne réserve de récapitulatif pour un weekend sans match", async () => {
    const { deps, claimed } = makeDeps({ listWeekendMatches: () => Promise.resolve([]) });
    expect(await runReminders(deps, THURSDAY)).toMatchObject({ sent: 1, nothingToSend: 1 });
    expect([...claimed].some((key) => key.includes("weekend_recap"))).toBe(false);
  });

  it("parcourt toutes les pages de destinataires", async () => {
    const page = Array.from({ length: REMINDER_RECIPIENTS_PAGE_SIZE }, (_, index) => ({
      ...recipient,
      userId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      settings: { ...recipient.settings, weekendRecapEnabled: false },
    }));
    const listRecipients = vi.fn((afterUserId: string | null) =>
      Promise.resolve(afterUserId === null ? page : [recipient]),
    );
    const { deps } = makeDeps({ listRecipients });
    const result = await runReminders(deps, MONDAY);
    expect(listRecipients).toHaveBeenCalledTimes(2);
    expect(listRecipients).toHaveBeenLastCalledWith(page.at(-1)?.userId);
    expect(result.sent).toBe(REMINDER_RECIPIENTS_PAGE_SIZE + 1);
  });
});

describe("processReminder", () => {
  const reminder = {
    kind: "availability",
    periodStart: "2026-11-02",
    weekendSaturday: "2026-12-12",
  } as const;

  it("libère la réservation et signale le nom de l'erreur si l'envoi échoue", async () => {
    const { deps, claimed } = makeDeps({
      send: () => Promise.reject(new EmailDeliveryError("smtp clem@example.com")),
    });
    expect(await processReminder(deps, recipient, reminder)).toBe("failed");
    expect(claimed.size).toBe(0);
    expect(deps.onError).toHaveBeenCalledWith("EmailDeliveryError");
    expect(deps.onError).not.toHaveBeenCalledWith(expect.stringContaining("@"));
  });

  it("ne lève jamais d'erreur, même si la base échoue", async () => {
    const { deps } = makeDeps({ claim: () => Promise.reject(new TypeError("db down")) });
    expect(await processReminder(deps, recipient, reminder)).toBe("failed");
    expect(deps.onError).toHaveBeenCalledWith("TypeError");
  });

  it("signale aussi l'échec de la libération", async () => {
    const { deps } = makeDeps({
      send: () => Promise.reject(new EmailDeliveryError("smtp")),
      release: () => Promise.reject(new RangeError("db down")),
    });
    expect(await processReminder(deps, recipient, reminder)).toBe("failed");
    expect(deps.onError).toHaveBeenCalledWith("RangeError");
    expect(deps.onError).toHaveBeenCalledWith("EmailDeliveryError");
  });
});
