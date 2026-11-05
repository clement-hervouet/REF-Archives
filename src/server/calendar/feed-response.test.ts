import { describe, expect, it, vi } from "vitest";
import { generateToken, hashToken } from "@/server/auth/tokens";
import type { CalendarMatch } from "@/server/db/calendar-matches";
import {
  calendarHeaders,
  matchExportFileName,
  notFoundHeaders,
  serveCalendarFeed,
} from "./feed-response";
import type { CalendarFeedDeps } from "./feed-response";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const NOW = new Date("2026-11-05T17:00:00.000Z");

const MATCH: CalendarMatch = {
  id: "8c2d4f6a-1b3e-4a5c-9d7e-0f1a2b3c4d5e",
  startsAt: new Date("2026-11-06T19:30:00.000Z"),
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
  division: { category: "Regional", type: "Masculin", level: "2" },
  team1Name: "BC Béthune",
  team2Name: "US Arras",
  address: { street: "Avenue du Sport", number: "2", postalCode: "62400", city: "Béthune" },
};

function makeDeps(userId: string | null, matches: CalendarMatch[] = [MATCH]) {
  const findUserIdByTokenHash = vi
    .fn<CalendarFeedDeps["findUserIdByTokenHash"]>()
    .mockResolvedValue(userId);
  const listMatchesSince = vi
    .fn<CalendarFeedDeps["listMatchesSince"]>()
    .mockResolvedValue(matches);
  return {
    deps: { findUserIdByTokenHash, listMatchesSince } satisfies CalendarFeedDeps,
    findUserIdByTokenHash,
    listMatchesSince,
  };
}

describe("serveCalendarFeed", () => {
  it("renvoie le flux du propriétaire du jeton, sur 12 mois d'historique", async () => {
    const { token } = generateToken();
    const { deps, findUserIdByTokenHash, listMatchesSince } = makeDeps(USER_ID);
    const ics = await serveCalendarFeed(deps, `${token}.ics`, NOW);
    expect(ics).toContain(`UID:compensation-${MATCH.id}@ref-archives`);
    expect(findUserIdByTokenHash).toHaveBeenCalledWith(hashToken(token));
    expect(listMatchesSince).toHaveBeenCalledWith({
      userId: USER_ID,
      from: new Date("2025-11-05T17:00:00.000Z"),
    });
  });

  it("renvoie un calendrier vide valide quand il n'y a aucun match", async () => {
    const { token } = generateToken();
    const { deps } = makeDeps(USER_ID, []);
    const ics = await serveCalendarFeed(deps, `${token}.ics`, NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("renvoie null pour un jeton inconnu ou révoqué", async () => {
    const { token } = generateToken();
    const { deps, listMatchesSince } = makeDeps(null);
    expect(await serveCalendarFeed(deps, `${token}.ics`, NOW)).toBeNull();
    expect(listMatchesSince).not.toHaveBeenCalled();
  });

  it("renvoie null sans interroger la base pour un nom de fichier mal formé", async () => {
    const { deps, findUserIdByTokenHash } = makeDeps(USER_ID);
    for (const file of ["abc.ics", "", `${"a".repeat(43)}.txt`, "%00.ics"]) {
      expect(await serveCalendarFeed(deps, file, NOW)).toBeNull();
    }
    expect(findUserIdByTokenHash).not.toHaveBeenCalled();
  });
});

describe("calendarHeaders", () => {
  it("sert un fichier texte/calendrier jamais mis en cache, sans Referer", () => {
    const headers = calendarHeaders({
      pathname: "/api/ical/x.ics",
      fileName: "ref-archives.ics",
      disposition: "inline",
    });
    expect(headers["Content-Type"]).toBe("text/calendar; charset=utf-8");
    expect(headers["Content-Disposition"]).toBe('inline; filename="ref-archives.ics"');
    expect(headers["Cache-Control"]).toBe("private, no-store");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("propose le téléchargement pour un export", () => {
    const headers = calendarHeaders({
      pathname: "/indemnites/x/ics",
      fileName: "match-2026-11-06.ics",
      disposition: "attachment",
    });
    expect(headers["Content-Disposition"]).toBe('attachment; filename="match-2026-11-06.ics"');
  });
});

describe("notFoundHeaders", () => {
  it("ne met rien en cache et garde les en-têtes de sécurité", () => {
    const headers = notFoundHeaders("/api/ical/x.ics");
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});

describe("matchExportFileName", () => {
  it("utilise la date du match à Paris", () => {
    // 23:30 UTC le 31/12 = 00:30 le 01/01 à Paris.
    expect(matchExportFileName({ startsAt: new Date("2026-12-31T23:30:00.000Z") })).toBe(
      "match-2027-01-01.ics",
    );
  });
});
