import { describe, expect, it } from "vitest";
import { parseThemeForm } from "./theme";

function form(theme?: string): FormData {
  const data = new FormData();
  if (theme !== undefined) {
    data.set("theme", theme);
  }
  return data;
}

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

  it("refuse un type inattendu (fichier, valeurs multiples)", () => {
    const data = new FormData();
    data.set("theme", new Blob(["dark"]), "theme.txt");
    expect(parseThemeForm(data)).toBeNull();
  });
});
