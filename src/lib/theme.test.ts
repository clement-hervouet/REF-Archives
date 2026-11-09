import { describe, expect, it } from "vitest";
import { parseThemeForm, themeAttributeFromCookie, themePreferenceFromCookie } from "./theme";

function form(theme?: string): FormData {
  const data = new FormData();
  if (theme !== undefined) {
    data.set("theme", theme);
  }
  return data;
}

describe("themeAttributeFromCookie", () => {
  it("impose le thème clair ou sombre choisi", () => {
    expect(themeAttributeFromCookie("light")).toBe("light");
    expect(themeAttributeFromCookie("dark")).toBe("dark");
  });

  it("suit le système sans cookie, avec « system » ou avec une valeur inconnue", () => {
    expect(themeAttributeFromCookie(undefined)).toBeUndefined();
    expect(themeAttributeFromCookie("system")).toBeUndefined();
    expect(themeAttributeFromCookie("")).toBeUndefined();
    expect(themeAttributeFromCookie('dark" onload="x')).toBeUndefined();
  });
});

describe("themePreferenceFromCookie", () => {
  it("renvoie la préférence à cocher dans le formulaire", () => {
    expect(themePreferenceFromCookie("dark")).toBe("dark");
    expect(themePreferenceFromCookie("light")).toBe("light");
    expect(themePreferenceFromCookie(undefined)).toBe("system");
    expect(themePreferenceFromCookie("bleu")).toBe("system");
  });
});

describe("parseThemeForm", () => {
  it("accepte les trois préférences", () => {
    expect(parseThemeForm(form("system"))).toBe("system");
    expect(parseThemeForm(form("light"))).toBe("light");
    expect(parseThemeForm(form("dark"))).toBe("dark");
  });

  it("refuse une valeur absente ou inconnue", () => {
    expect(parseThemeForm(form())).toBeNull();
    expect(parseThemeForm(form("Dark"))).toBeNull();
    expect(parseThemeForm(form("auto"))).toBeNull();
  });
});
