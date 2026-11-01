import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("affiche l'heure de Paris en hiver (UTC+1)", () => {
    expect(formatDateTime(new Date("2026-11-01T10:00:00.000Z"))).toMatch(/^01\/11\/2026\D+11:00$/);
  });

  it("affiche l'heure de Paris en été (UTC+2)", () => {
    expect(formatDateTime(new Date("2026-07-01T10:00:00.000Z"))).toMatch(/^01\/07\/2026\D+12:00$/);
  });

  it("passe au jour suivant quand Paris a déjà changé de date", () => {
    expect(formatDateTime(new Date("2026-12-31T23:30:00.000Z"))).toMatch(/^01\/01\/2027\D+00:30$/);
  });
});