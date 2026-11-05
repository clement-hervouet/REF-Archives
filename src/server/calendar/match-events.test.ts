import { describe, expect, it } from "vitest";
import type { CalendarMatch } from "@/server/db/calendar-matches";
import {
  buildFeedCalendar,
  buildMatchCalendar,
  feedHistoryStart,
  matchToEvent,
  matchUid,
} from "./match-events";

const GENERATED_AT = new Date("2026-11-05T17:00:00.000Z");

const MATCH: CalendarMatch = {
  id: "8c2d4f6a-1b3e-4a5c-9d7e-0f1a2b3c4d5e",
  // 20:30 à Paris (heure d'hiver, UTC+1).
  startsAt: new Date("2026-11-06T19:30:00.000Z"),
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
  division: { category: "Regional", type: "Masculin", level: "2" },
  team1Name: "BC Béthune",
  team2Name: "US Arras",
  address: { street: "Avenue du Sport", number: "2", postalCode: "62400", city: "Béthune" },
};

function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

describe("matchUid", () => {
  it("dérive l'UID de l'identifiant de l'indemnité", () => {
    expect(matchUid(MATCH.id)).toBe(`compensation-${MATCH.id}@ref-archives`);
  });
});

describe("feedHistoryStart", () => {
  it("remonte de 12 mois", () => {
    expect(feedHistoryStart(GENERATED_AT)).toEqual(new Date("2025-11-05T17:00:00.000Z"));
  });

  it("ne modifie pas la date reçue", () => {
    const now = new Date(GENERATED_AT.getTime());
    feedHistoryStart(now);
    expect(now).toEqual(GENERATED_AT);
  });
});

describe("matchToEvent", () => {
  it("commence 1 h avant le coup d'envoi et dure 3 h", () => {
    const event = matchToEvent(MATCH);
    expect(event.start).toEqual(new Date("2026-11-06T18:30:00.000Z"));
    expect(event.end).toEqual(new Date("2026-11-06T21:30:00.000Z"));
  });

  it("reprend les équipes, l'adresse, le niveau et l'heure de Paris", () => {
    const event = matchToEvent(MATCH);
    expect(event.uid).toBe(matchUid(MATCH.id));
    expect(event.summary).toContain("BC Béthune – US Arras");
    expect(event.location).toBe("2 Avenue du Sport, 62400 Béthune");
    expect(event.description).toContain("vendredi 06/11 à 20:30");
    expect(event.description).toContain("Régional");
    expect(event.lastModified).toEqual(MATCH.updatedAt);
  });

  it("garde littéralement un nom d'équipe contenant des motifs de remplacement", () => {
    const event = matchToEvent({ ...MATCH, team1Name: "A$&B", team2Name: "$1" });
    expect(event.summary).toContain("A$&B – $1");
  });
});

describe("buildFeedCalendar", () => {
  it("produit un événement par match, avec rafraîchissement", () => {
    const other = { ...MATCH, id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" };
    const lines = unfold(buildFeedCalendar([MATCH, other], GENERATED_AT));
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines).toContain(`UID:compensation-${other.id}@ref-archives`);
    expect(lines).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
  });

  it("n'expose ni montant ni barème", () => {
    const ics = buildFeedCalendar([MATCH], GENERATED_AT);
    expect(ics).not.toMatch(/€|barème/i);
  });
});

describe("buildMatchCalendar", () => {
  it("exporte un seul événement avec le même UID que le flux, sans rafraîchissement", () => {
    const lines = unfold(buildMatchCalendar(MATCH, GENERATED_AT));
    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines).toContain(`UID:compensation-${MATCH.id}@ref-archives`);
    expect(lines.some((line) => line.startsWith("REFRESH-INTERVAL"))).toBe(false);
  });
});
