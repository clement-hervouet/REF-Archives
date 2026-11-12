import { describe, expect, it, vi } from "vitest";
import type { UserDataExport } from "../db/data-export";
import {
  buildDataExportDocument,
  dataExportFileName,
  dataExportHeaders,
  dataExportNotFoundHeaders,
  dataExportRateLimitedHeaders,
  exportRateLimitKeys,
  handleDataExport,
} from "./data-export";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
// 9 novembre 2026, 23 h 30 à Paris (22 h 30 UTC).
const NOW = new Date("2026-11-09T22:30:00Z");

const DATA: UserDataExport = {
  account: { id: USER_ID, email: "a@example.test" },
  addresses: [],
  clubs: [{ id: "club-1", name: "BC Exemple" }],
  teams: [],
  persons: [],
  scales: [],
  levelDefaultScales: [],
  games: [],
  notes: [],
  compensations: [],
  calendarFeed: null,
  sessions: [],
  securityEvents: [],
  reminderDispatches: [],
};

describe("dataExportFileName", () => {
  it("prend la date de Paris", () => {
    expect(dataExportFileName(NOW)).toBe("ref-archives-2026-11-09.json");
    expect(dataExportFileName(new Date("2026-11-09T23:30:00Z"))).toBe(
      "ref-archives-2026-11-10.json",
    );
  });
});

describe("buildDataExportDocument", () => {
  it("ajoute format, version et date, puis les sections, en JSON indenté", () => {
    const text = buildDataExportDocument(DATA, NOW);
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toEqual({
      format: "ref-archives-export",
      version: 1,
      exportedAt: "2026-11-09T22:30:00.000Z",
      ...DATA,
    });
    expect(text).toContain('\n  "format": "ref-archives-export"');
    expect(text.endsWith("\n")).toBe(true);
  });
});

describe("en-têtes", () => {
  it("fichier : téléchargement JSON, jamais en cache, CSP fermée", () => {
    const headers = dataExportHeaders({
      pathname: "/parametres/export",
      fileName: "ref-archives-2026-11-09.json",
    });
    expect(headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(headers["Content-Disposition"]).toBe(
      'attachment; filename="ref-archives-2026-11-09.json"',
    );
    expect(headers["Cache-Control"]).toBe("private, no-store");
    expect(headers["Content-Security-Policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("404 : rien en cache", () => {
    expect(dataExportNotFoundHeaders("/parametres/export")["Cache-Control"]).toBe("no-store");
  });

  it("429 : comme un 404 plus Retry-After arrondi à la seconde supérieure (≥ 1)", () => {
    const headers = dataExportRateLimitedHeaders("/parametres/export", 90.2);
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["Content-Security-Policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(headers["Retry-After"]).toBe("91");
    expect(dataExportRateLimitedHeaders("/parametres/export", 0)["Retry-After"]).toBe("1");
  });
});

describe("exportRateLimitKeys", () => {
  it("hache l'identifiant et l'IP (jamais en clair), préfixés par compte et par IP", () => {
    const keys = exportRateLimitKeys(USER_ID, "203.0.113.4");
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^export:user:[0-9a-f]{64}$/);
    expect(keys[1]).toMatch(/^export:ip:[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain(USER_ID);
    expect(keys[1]).not.toContain("203.0.113.4");
  });

  it("est déterministe (mêmes entrées, mêmes clés)", () => {
    expect(exportRateLimitKeys(USER_ID, "203.0.113.4")).toEqual(
      exportRateLimitKeys(USER_ID, "203.0.113.4"),
    );
  });
});

describe("handleDataExport", () => {
  it("construit le fichier et journalise l'export", async () => {
    const read = vi
      .fn<(userId: string) => Promise<UserDataExport | null>>()
      .mockResolvedValue(DATA);
    const record = vi.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined);
    const result = await handleDataExport({ read, record }, USER_ID, NOW);
    expect(read).toHaveBeenCalledWith(USER_ID);
    expect(record).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({
      status: "ok",
      fileName: "ref-archives-2026-11-09.json",
      body: buildDataExportDocument(DATA, NOW),
    });
  });

  it("compte introuvable : 404, rien de journalisé", async () => {
    const read = vi
      .fn<(userId: string) => Promise<UserDataExport | null>>()
      .mockResolvedValue(null);
    const record = vi.fn<(userId: string) => Promise<void>>();
    expect(await handleDataExport({ read, record }, USER_ID, NOW)).toEqual({
      status: "not_found",
    });
    expect(record).not.toHaveBeenCalled();
  });
});
