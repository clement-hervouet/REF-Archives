import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { formatCents, formatCentsPerKm, formatDateTime, formatIsoDate } from "./format";

/** Remplace les espaces insécables par des espaces simples, pour des attentes lisibles. */
function plain(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

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

describe("formatIsoDate", () => {
  it("affiche une date calendaire au format français, sans décalage de fuseau", () => {
    expect(formatIsoDate("2026-09-01")).toBe("01/09/2026");
    expect(formatIsoDate("2026-12-31")).toBe("31/12/2026");
  });

  it("refuse une date invalide", () => {
    expect(() => formatIsoDate("2026-02-30")).toThrow(ValidationError);
  });
});

describe("formatCents", () => {
  it("affiche des euros avec deux décimales", () => {
    expect(plain(formatCents(4800))).toBe("48,00 €");
    expect(plain(formatCents(4505))).toBe("45,05 €");
    expect(plain(formatCents(0))).toBe("0,00 €");
  });

  it("sépare les milliers", () => {
    expect(plain(formatCents(480_050))).toBe("4 800,50 €");
  });

  it("garde le signe d'un montant négatif", () => {
    expect(plain(formatCents(-150))).toBe("-1,50 €");
  });

  it("refuse un montant non entier", () => {
    expect(() => formatCents(10.5)).toThrow(ValidationError);
  });
});

describe("formatCentsPerKm", () => {
  it("affiche le taux en euros par km avec deux décimales au minimum", () => {
    expect(plain(formatCentsPerKm("40.00"))).toBe("0,40 €/km");
    expect(plain(formatCentsPerKm("40"))).toBe("0,40 €/km");
    expect(plain(formatCentsPerKm("100.00"))).toBe("1,00 €/km");
    expect(plain(formatCentsPerKm("0.00"))).toBe("0,00 €/km");
  });

  it("garde les décimales utiles jusqu'à quatre", () => {
    expect(plain(formatCentsPerKm("42.50"))).toBe("0,425 €/km");
    expect(plain(formatCentsPerKm("42.5"))).toBe("0,425 €/km");
    expect(plain(formatCentsPerKm("42.57"))).toBe("0,4257 €/km");
    expect(plain(formatCentsPerKm("9999.99"))).toBe("99,9999 €/km");
  });

  it("refuse un taux mal formé", () => {
    expect(() => formatCentsPerKm("0,40")).toThrow(ValidationError);
  });
});