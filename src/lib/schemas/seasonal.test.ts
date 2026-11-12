import { describe, expect, it } from "vitest";
import { parseSeasonalForm } from "./seasonal";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("parseSeasonalForm", () => {
  it("lit l'état et la densité", () => {
    expect(parseSeasonalForm(form({ seasonal: "on", density: "high" }))).toEqual({
      enabled: true,
      density: "high",
    });
    expect(parseSeasonalForm(form({ seasonal: "off", density: "low" }))).toEqual({
      enabled: false,
      density: "low",
    });
  });

  it("accepte l'état seul (bandeau) sans toucher à la densité", () => {
    expect(parseSeasonalForm(form({ seasonal: "off" }))).toEqual({
      enabled: false,
      density: null,
    });
  });

  it("refuse un formulaire incomplet ou forgé", () => {
    expect(parseSeasonalForm(form({}))).toBeNull();
    expect(parseSeasonalForm(form({ density: "high" }))).toBeNull();
    expect(parseSeasonalForm(form({ seasonal: "yes" }))).toBeNull();
    expect(parseSeasonalForm(form({ seasonal: "on", density: "max" }))).toBeNull();
  });

  it("refuse un type inattendu (fichier) pour l'état", () => {
    const data = new FormData();
    data.set("seasonal", new Blob(["on"]), "seasonal.txt");
    expect(parseSeasonalForm(data)).toBeNull();
  });
});
