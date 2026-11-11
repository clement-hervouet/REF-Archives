/**
 * Thème saisonnier (bloc 12, §3.14) : une animation décorative par-dessus le thème clair
 * ou sombre, qui change avec la « saison météo » (à ne pas confondre avec la saison FFBB
 * de `seasons.ts`, du 1er juillet au 30 juin).
 *
 * Dates météorologiques, au jour de Paris : printemps au 1er mars, été au 1er juin,
 * automne au 1er septembre, hiver au 1er décembre (jusqu'à fin février).
 *
 * Les choix sont gardés dans deux cookies par appareil, lus côté serveur (comme `theme`) :
 * - l'état, rattaché à une saison précise (`autumn-2026:off`) : une nouvelle saison ne
 *   correspond plus au cookie, le thème revient donc tout seul et s'annonce de nouveau ;
 * - la densité, qui vaut pour toutes les saisons.
 */
import { toParisIsoDate } from "./dates";

export const WEATHER_SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type WeatherSeason = (typeof WEATHER_SEASONS)[number];

export const SEASONAL_DENSITIES = ["low", "medium", "high"] as const;
export type SeasonalDensity = (typeof SEASONAL_DENSITIES)[number];

/** Densité par défaut : la plus discrète (§3.14). */
const DEFAULT_SEASONAL_DENSITY: SeasonalDensity = "low";

/**
 * Nombre d'éléments animés selon la saison et la densité (§3.14). Peu d'éléments, pour
 * rester léger sur téléphone : les feuilles, plus grandes, sont les moins nombreuses.
 */
export const SEASONAL_PARTICLE_COUNTS: Record<WeatherSeason, Record<SeasonalDensity, number>> = {
  spring: { low: 12, medium: 20, high: 32 },
  summer: { low: 10, medium: 18, high: 28 },
  autumn: { low: 8, medium: 14, high: 22 },
  winter: { low: 30, medium: 60, high: 100 },
};

/** Cookie d'état : `<saison>-<année>:on` ou `:off`. Absent = saison jamais vue. */
export const SEASONAL_STATE_COOKIE = "seasonal";

/** Cookie de densité : `low`, `medium` ou `high`. Absent = densité par défaut. */
export const SEASONAL_DENSITY_COOKIE = "seasonal-density";

/** Un an, comme le cookie `theme` : rien de sensible. */
export const SEASONAL_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Une saison météo précise, ex. l'hiver 2026 (décembre 2026 → février 2027). */
export type SeasonalPeriod = {
  season: WeatherSeason;
  /** Année de début : l'hiver porte l'année de son mois de décembre. */
  year: number;
  /** Identifiant stable gardé dans le cookie, ex. `winter-2026`. */
  id: string;
  /** Vrai en décembre : la guirlande s'ajoute à la neige. */
  december: boolean;
};

/** Ce que la page doit faire pour la saison en cours. */
export type SeasonalState = {
  period: SeasonalPeriod;
  enabled: boolean;
  /** Première apparition de cette saison sur cet appareil : afficher le bandeau. */
  announce: boolean;
  density: SeasonalDensity;
};

const STATE_PATTERN = /^(spring|summer|autumn|winter)-(\d{4}):(on|off)$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-\d{2}$/;

function isSeasonalDensity(value: unknown): value is SeasonalDensity {
  return typeof value === "string" && SEASONAL_DENSITIES.some((density) => density === value);
}

function seasonOfMonth(month: number): WeatherSeason {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/** Saison météo d'un jour `AAAA-MM-JJ` (jour de Paris, déjà calculé). */
export function seasonalPeriodOn(isoDate: string): SeasonalPeriod {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (match === null) {
    throw new RangeError(`Date invalide : ${isoDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const season = seasonOfMonth(month);
  // Janvier et février appartiennent à l'hiver commencé en décembre de l'année précédente.
  const startYear = season === "winter" && month <= 2 ? year - 1 : year;
  return { season, year: startYear, id: `${season}-${String(startYear)}`, december: month === 12 };
}

/** Saison météo à l'instant `now`, au jour de Paris quel que soit le fuseau du serveur. */
export function currentSeasonalPeriod(now: Date): SeasonalPeriod {
  return seasonalPeriodOn(toParisIsoDate(now));
}

/** Densité gardée dans le cookie (absente ou inconnue = densité par défaut). */
export function seasonalDensityFromCookie(cookieValue: string | undefined): SeasonalDensity {
  return isSeasonalDensity(cookieValue) ? cookieValue : DEFAULT_SEASONAL_DENSITY;
}

/**
 * État du thème pour la saison en cours. Le cookie ne compte que s'il porte sur cette
 * saison : sinon (absent, ancienne saison, valeur forgée) le thème est actif et s'annonce.
 */
export function resolveSeasonalState(
  period: SeasonalPeriod,
  stateCookie: string | undefined,
  densityCookie: string | undefined,
): SeasonalState {
  const density = seasonalDensityFromCookie(densityCookie);
  const match = stateCookie === undefined ? null : STATE_PATTERN.exec(stateCookie);
  // Le motif garantit les trois groupes ; les `?? ""` satisfont `noUncheckedIndexedAccess`.
  const seasonId = match === null ? null : `${match[1] ?? ""}-${match[2] ?? ""}`;
  if (match === null || seasonId !== period.id) {
    return { period, enabled: true, announce: true, density };
  }
  return { period, enabled: match[3] === "on", announce: false, density };
}

/** Valeur du cookie d'état pour la saison `period`. */
export function seasonalStateCookieValue(period: SeasonalPeriod, enabled: boolean): string {
  return `${period.id}:${enabled ? "on" : "off"}`;
}

/** Choix envoyé par la section « Thème saisonnier » ou par le bandeau. */
export type SeasonalChoice = {
  enabled: boolean;
  /** `null` : densité non envoyée (bandeau), la valeur actuelle est gardée. */
  density: SeasonalDensity | null;
};

/**
 * Lit le formulaire : `seasonal` (`on` | `off`, obligatoire) et `density` (facultatif).
 * Renvoie `null` si une valeur est absente ou inconnue (formulaire forgé).
 */
export function parseSeasonalForm(formData: FormData): SeasonalChoice | null {
  const enabled = formData.get("seasonal");
  if (enabled !== "on" && enabled !== "off") {
    return null;
  }
  const density = formData.get("density");
  if (density === null) {
    return { enabled: enabled === "on", density: null };
  }
  if (!isSeasonalDensity(density)) {
    return null;
  }
  return { enabled: enabled === "on", density };
}
