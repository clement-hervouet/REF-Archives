import { describe, expect, it } from "vitest";
import {
  SEASONAL_DENSITIES,
  SEASONAL_PARTICLE_COUNTS,
  WEATHER_SEASONS,
  currentSeasonalPeriod,
  parseSeasonalForm,
  resolveSeasonalState,
  seasonalDensityFromCookie,
  seasonalPeriodOn,
  seasonalStateCookieValue,
} from "./seasonal-theme";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("seasonalPeriodOn", () => {
  it("suit les dates météorologiques (1er mars, juin, septembre, décembre)", () => {
    expect(seasonalPeriodOn("2026-02-28").season).toBe("winter");
    expect(seasonalPeriodOn("2026-03-01").season).toBe("spring");
    expect(seasonalPeriodOn("2026-05-31").season).toBe("spring");
    expect(seasonalPeriodOn("2026-06-01").season).toBe("summer");
    expect(seasonalPeriodOn("2026-08-31").season).toBe("summer");
    expect(seasonalPeriodOn("2026-09-01").season).toBe("autumn");
    expect(seasonalPeriodOn("2026-11-30").season).toBe("autumn");
    expect(seasonalPeriodOn("2026-12-01").season).toBe("winter");
  });

  it("donne à l'hiver l'année de son mois de décembre", () => {
    expect(seasonalPeriodOn("2026-12-15").id).toBe("winter-2026");
    expect(seasonalPeriodOn("2027-01-10").id).toBe("winter-2026");
    expect(seasonalPeriodOn("2028-02-29").id).toBe("winter-2027");
    expect(seasonalPeriodOn("2026-10-01").id).toBe("autumn-2026");
  });

  it("signale décembre seulement (guirlande)", () => {
    expect(seasonalPeriodOn("2026-12-01").december).toBe(true);
    expect(seasonalPeriodOn("2026-12-31").december).toBe(true);
    expect(seasonalPeriodOn("2027-01-01").december).toBe(false);
    expect(seasonalPeriodOn("2026-11-30").december).toBe(false);
  });

  it("refuse une date mal formée", () => {
    expect(() => seasonalPeriodOn("01/12/2026")).toThrow(RangeError);
  });
});

describe("currentSeasonalPeriod", () => {
  it("prend le jour de Paris, pas celui d'UTC", () => {
    // 30 novembre à 23h30 UTC = 1er décembre à 00h30 à Paris : déjà l'hiver.
    expect(currentSeasonalPeriod(new Date("2026-11-30T23:30:00Z")).id).toBe("winter-2026");
    // 31 mai à 21h59 UTC = 31 mai à 23h59 à Paris (heure d'été) : encore le printemps.
    expect(currentSeasonalPeriod(new Date("2026-05-31T21:59:00Z")).season).toBe("spring");
  });
});

describe("seasonalDensityFromCookie", () => {
  it("garde une densité connue et revient au défaut sinon", () => {
    expect(seasonalDensityFromCookie("high")).toBe("high");
    expect(seasonalDensityFromCookie("medium")).toBe("medium");
    expect(seasonalDensityFromCookie(undefined)).toBe("low");
    expect(seasonalDensityFromCookie("max")).toBe("low");
  });
});

describe("resolveSeasonalState", () => {
  const autumn = seasonalPeriodOn("2026-10-15");

  it("active et annonce une saison jamais vue", () => {
    expect(resolveSeasonalState(autumn, undefined, undefined)).toEqual({
      period: autumn,
      enabled: true,
      announce: true,
      density: "low",
    });
  });

  it("respecte le choix fait pour cette saison, sans l'annoncer de nouveau", () => {
    expect(resolveSeasonalState(autumn, "autumn-2026:off", "medium")).toMatchObject({
      enabled: false,
      announce: false,
      density: "medium",
    });
    expect(resolveSeasonalState(autumn, "autumn-2026:on", undefined)).toMatchObject({
      enabled: true,
      announce: false,
    });
  });

  it("réactive le thème à la saison suivante, même désactivé avant", () => {
    const winter = seasonalPeriodOn("2026-12-01");
    expect(resolveSeasonalState(winter, "autumn-2026:off", "high")).toMatchObject({
      enabled: true,
      announce: true,
      density: "high",
    });
    // Même saison, autre année : c'est une nouvelle saison.
    expect(resolveSeasonalState(autumn, "autumn-2025:off", undefined)).toMatchObject({
      enabled: true,
      announce: true,
    });
  });

  it("traite une valeur forgée comme une saison jamais vue", () => {
    for (const forged of ["", "autumn-2026", "autumn-2026:maybe", "x autumn-2026:off"]) {
      expect(resolveSeasonalState(autumn, forged, undefined)).toMatchObject({
        enabled: true,
        announce: true,
      });
    }
  });
});

describe("seasonalStateCookieValue", () => {
  it("rattache le choix à la saison", () => {
    const period = seasonalPeriodOn("2027-04-02");
    expect(seasonalStateCookieValue(period, true)).toBe("spring-2027:on");
    expect(seasonalStateCookieValue(period, false)).toBe("spring-2027:off");
  });
});

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
});

describe("SEASONAL_PARTICLE_COUNTS", () => {
  it("augmente avec la densité pour chaque saison", () => {
    for (const season of WEATHER_SEASONS) {
      const counts = SEASONAL_DENSITIES.map((density) => SEASONAL_PARTICLE_COUNTS[season][density]);
      expect(counts).toEqual([...counts].sort((a, b) => a - b));
      expect(new Set(counts).size).toBe(counts.length);
    }
  });

  it("reste léger : jamais plus de 100 éléments", () => {
    for (const season of WEATHER_SEASONS) {
      expect(SEASONAL_PARTICLE_COUNTS[season].high).toBeLessThanOrEqual(100);
    }
  });
});
