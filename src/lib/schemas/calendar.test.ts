import { describe, expect, it } from "vitest";
import { generateToken } from "@/server/auth/tokens";
import { parseCalendarFeedFile, parseCalendarFeedIntent } from "./calendar";

const TOKEN = "a".repeat(20) + "B-_9".repeat(5) + "zzz";

describe("parseCalendarFeedFile", () => {
  it("extrait le jeton d'un nom de fichier valide", () => {
    expect(TOKEN).toHaveLength(43);
    expect(parseCalendarFeedFile(`${TOKEN}.ics`)).toBe(TOKEN);
  });

  it("accepte les jetons produits par generateToken", () => {
    const { token } = generateToken();
    expect(parseCalendarFeedFile(`${token}.ics`)).toBe(token);
  });

  it("refuse une extension absente ou différente", () => {
    expect(parseCalendarFeedFile(TOKEN)).toBeNull();
    expect(parseCalendarFeedFile(`${TOKEN}.ICS`)).toBeNull();
    expect(parseCalendarFeedFile(`${TOKEN}.ics.txt`)).toBeNull();
  });

  it("refuse un jeton trop court, trop long ou hors base64url", () => {
    expect(parseCalendarFeedFile(`${TOKEN.slice(1)}.ics`)).toBeNull();
    expect(parseCalendarFeedFile(`${TOKEN}a.ics`)).toBeNull();
    expect(parseCalendarFeedFile(`${TOKEN.slice(1)}+.ics`)).toBeNull();
    expect(parseCalendarFeedFile(`${TOKEN.slice(1)}=.ics`)).toBeNull();
    expect(parseCalendarFeedFile(`../${TOKEN.slice(3)}.ics`)).toBeNull();
  });
});

describe("parseCalendarFeedIntent", () => {
  function form(intent?: string): FormData {
    const data = new FormData();
    if (intent !== undefined) {
      data.set("intent", intent);
    }
    return data;
  }

  it("accepte create et revoke", () => {
    expect(parseCalendarFeedIntent(form("create"))).toBe("create");
    expect(parseCalendarFeedIntent(form("revoke"))).toBe("revoke");
  });

  it("refuse une intention absente ou inconnue", () => {
    expect(parseCalendarFeedIntent(form())).toBeNull();
    expect(parseCalendarFeedIntent(form("delete"))).toBeNull();
    expect(parseCalendarFeedIntent(form("CREATE"))).toBeNull();
  });
});
