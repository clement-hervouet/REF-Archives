import { describe, expect, it } from "vitest";
import { parseAccountEdit, parseBlockChoice } from "./accounts";

const NOW = new Date("2026-11-08T19:00:00Z"); // 20:00 à Paris

describe("parseAccountEdit", () => {
  it("nettoie et valide nom, prénom, email et rôle", () => {
    expect(
      parseAccountEdit({
        firstname: " Alex ",
        lastname: "Martin",
        email: " Alex@Example.TEST ",
        role: "admin",
      }),
    ).toEqual({
      success: true,
      edit: { firstname: "Alex", lastname: "Martin", email: "alex@example.test", role: "admin" },
    });
  });

  it("renvoie toutes les erreurs, champ par champ", () => {
    expect(
      parseAccountEdit({ firstname: "", lastname: "M", email: "pas-un-email", role: "root" }),
    ).toEqual({
      success: false,
      issues: ["firstname.required", "email.invalid", "role.invalid"],
    });
  });
});

describe("parseBlockChoice", () => {
  it("durées : à partir de maintenant", () => {
    expect(parseBlockChoice({ mode: "24h", date: "" }, NOW)).toEqual({
      success: true,
      until: new Date("2026-11-09T19:00:00Z"),
    });
    expect(parseBlockChoice({ mode: "30d", date: "" }, NOW)).toEqual({
      success: true,
      until: new Date("2026-12-08T19:00:00Z"),
    });
  });

  it("sans fin", () => {
    expect(parseBlockChoice({ mode: "indefinite", date: "" }, NOW)).toEqual({
      success: true,
      until: null,
    });
  });

  it("date : jusqu'à minuit à Paris ce jour-là (heure d'hiver)", () => {
    expect(parseBlockChoice({ mode: "date", date: "2026-11-15" }, NOW)).toEqual({
      success: true,
      until: new Date("2026-11-14T23:00:00Z"),
    });
  });

  it("date : aujourd'hui ou avant refusée, trop loin refusée, mal formée refusée", () => {
    expect(parseBlockChoice({ mode: "date", date: "2026-11-08" }, NOW)).toEqual({
      success: false,
      issue: "date.past",
    });
    expect(parseBlockChoice({ mode: "date", date: "2040-01-01" }, NOW)).toEqual({
      success: false,
      issue: "date.too_far",
    });
    expect(parseBlockChoice({ mode: "date", date: "15/11/2026" }, NOW)).toEqual({
      success: false,
      issue: "date.invalid",
    });
  });

  it("mode inconnu refusé", () => {
    expect(parseBlockChoice({ mode: "1y", date: "" }, NOW)).toEqual({
      success: false,
      issue: "mode.invalid",
    });
  });
});
