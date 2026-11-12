import { describe, expect, it } from "vitest";
import { themeAttributeFromCookie, themePreferenceFromCookie } from "./theme";

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
