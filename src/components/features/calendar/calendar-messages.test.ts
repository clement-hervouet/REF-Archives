import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { calendarFeedMessage } from "./calendar-messages";

const t = fr.calendar.settings;

describe("calendarFeedMessage", () => {
  it("n'affiche rien avant la première action", () => {
    expect(calendarFeedMessage("idle")).toBeNull();
  });

  it("confirme la création et la révocation", () => {
    expect(calendarFeedMessage("created")).toEqual({ tone: "success", text: t.created });
    expect(calendarFeedMessage("revoked")).toEqual({ tone: "success", text: t.revoked });
  });

  it("signale les erreurs", () => {
    expect(calendarFeedMessage("invalid")).toEqual({ tone: "error", text: t.errors.invalid });
    expect(calendarFeedMessage("not_found")).toEqual({ tone: "error", text: t.errors.notFound });
  });
});
