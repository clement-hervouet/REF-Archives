import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { buildCalendar, escapeText, foldLine, formatUtcDateTime } from "./ical";
import type { CalendarEvent } from "./ical";

const GENERATED_AT = new Date("2026-11-05T17:00:00.000Z");

const EVENT: CalendarEvent = {
  uid: "compensation-1@ref-archives",
  start: new Date("2026-11-06T18:30:00.000Z"),
  end: new Date("2026-11-06T21:30:00.000Z"),
  summary: "BC Béthune – US Arras",
};

/** Octets UTF-8 d'une ligne physique. */
function octets(line: string): number {
  return new TextEncoder().encode(line).length;
}

/** Déplie un fichier (inverse du pliage) puis le découpe en lignes logiques. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

describe("escapeText", () => {
  it("échappe la barre oblique inverse, le point-virgule et la virgule", () => {
    expect(escapeText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
  });

  it("remplace les sauts de ligne par \\n, quel que soit leur format", () => {
    expect(escapeText("a\nb\r\nc\rd")).toBe("a\\nb\\nc\\nd");
  });

  it("retire les caractères de contrôle mais garde la tabulation", () => {
    expect(escapeText("a\u0000b\u001bc\u007fd\te")).toBe("abcd\te");
  });

  it("laisse intacts les accents et les emojis", () => {
    expect(escapeText("Élan Chalon 🏀")).toBe("Élan Chalon 🏀");
  });
});

describe("formatUtcDateTime", () => {
  it("formate en UTC sans séparateurs ni millisecondes", () => {
    expect(formatUtcDateTime(new Date("2026-03-29T00:59:59.999Z"))).toBe("20260329T005959Z");
  });

  it("refuse une date invalide", () => {
    expect(() => formatUtcDateTime(new Date("nope"))).toThrow(ValidationError);
  });
});

describe("foldLine", () => {
  it("ne touche pas une ligne de 75 octets", () => {
    const line = "x".repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it("plie à 75 octets puis 74 octets de contenu par suite", () => {
    const folded = foldLine("x".repeat(200));
    const lines = folded.split("\r\n");
    expect(lines.map(octets)).toEqual([75, 75, 52]);
    expect(lines[1]?.startsWith(" ")).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("x".repeat(200));
  });

  it("ne coupe jamais un caractère multi-octets", () => {
    const line = `SUMMARY:${"é".repeat(60)}🏀${"à".repeat(40)}`;
    const lines = foldLine(line).split("\r\n");
    for (const physical of lines) {
      expect(octets(physical)).toBeLessThanOrEqual(75);
      expect(physical).not.toContain("�");
    }
    expect(foldLine(line).replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildCalendar", () => {
  it("produit un calendrier minimal valide, en CRLF, terminé par CRLF", () => {
    const ics = buildCalendar({ name: "Mes matchs", events: [EVENT], generatedAt: GENERATED_AT });
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(unfold(ics)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//REF-Archives//Matchs//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Mes matchs",
      "BEGIN:VEVENT",
      "UID:compensation-1@ref-archives",
      "DTSTAMP:20261105T170000Z",
      "DTSTART:20261106T183000Z",
      "DTEND:20261106T213000Z",
      "SUMMARY:BC Béthune – US Arras",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ]);
  });

  it("ajoute lieu, description et dernière modification, échappés", () => {
    const ics = buildCalendar({
      name: "Mes matchs",
      generatedAt: GENERATED_AT,
      events: [
        {
          ...EVENT,
          location: "2 Avenue du Sport, 62400 Béthune",
          description: "Coup d'envoi : 19:30\nNiveau : Régional",
          lastModified: new Date("2026-11-01T10:00:00.000Z"),
        },
      ],
    });
    const lines = unfold(ics);
    expect(lines).toContain("LOCATION:2 Avenue du Sport\\, 62400 Béthune");
    expect(lines).toContain("DESCRIPTION:Coup d'envoi : 19:30\\nNiveau : Régional");
    expect(lines).toContain("LAST-MODIFIED:20261101T100000Z");
  });

  it("indique l'intervalle de rafraîchissement quand il est demandé", () => {
    const lines = unfold(
      buildCalendar({ name: "M", events: [], generatedAt: GENERATED_AT, refreshHours: 6 }),
    );
    expect(lines).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(lines).toContain("X-PUBLISHED-TTL:PT6H");
  });

  it("accepte un calendrier sans événement", () => {
    const ics = buildCalendar({ name: "M", events: [], generatedAt: GENERATED_AT });
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("plie les lignes longues à 75 octets", () => {
    const ics = buildCalendar({
      name: "M",
      generatedAt: GENERATED_AT,
      events: [{ ...EVENT, description: "é".repeat(300) }],
    });
    for (const line of ics.split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
  });

  it("refuse un intervalle de rafraîchissement invalide", () => {
    for (const refreshHours of [0, 1.5, 169]) {
      expect(() =>
        buildCalendar({ name: "M", events: [], generatedAt: GENERATED_AT, refreshHours }),
      ).toThrow(ValidationError);
    }
  });

  it("refuse un événement qui finit avant de commencer", () => {
    expect(() =>
      buildCalendar({
        name: "M",
        generatedAt: GENERATED_AT,
        events: [{ ...EVENT, end: EVENT.start }],
      }),
    ).toThrow(ValidationError);
  });

  it("refuse un événement sans UID", () => {
    expect(() =>
      buildCalendar({ name: "M", generatedAt: GENERATED_AT, events: [{ ...EVENT, uid: " " }] }),
    ).toThrow(ValidationError);
  });
});
