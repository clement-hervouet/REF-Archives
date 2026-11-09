/**
 * Lecture et écriture des cookies du thème saisonnier (bloc 12, §3.14), côté serveur.
 * La logique (saisons, valeurs des cookies) est pure, dans `src/lib/seasonal-theme.ts`.
 */
import { cookies } from "next/headers";
import {
  SEASONAL_COOKIE_MAX_AGE_SECONDS,
  SEASONAL_DENSITY_COOKIE,
  SEASONAL_STATE_COOKIE,
  currentSeasonalPeriod,
  resolveSeasonalState,
  seasonalStateCookieValue,
} from "@/lib/seasonal-theme";
import type { SeasonalChoice, SeasonalState } from "@/lib/seasonal-theme";

/** État du thème saisonnier pour cet appareil, à l'instant `now` (heure du serveur par défaut). */
export async function getSeasonalState(now: Date = new Date()): Promise<SeasonalState> {
  const cookieStore = await cookies();
  return resolveSeasonalState(
    currentSeasonalPeriod(now),
    cookieStore.get(SEASONAL_STATE_COOKIE)?.value,
    cookieStore.get(SEASONAL_DENSITY_COOKIE)?.value,
  );
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SEASONAL_COOKIE_MAX_AGE_SECONDS,
} as const;

/**
 * Enregistre un choix pour la saison en cours. Écrire l'état marque aussi la saison comme
 * vue : le bandeau de première apparition ne revient pas.
 */
export async function saveSeasonalChoice(
  choice: SeasonalChoice,
  now: Date = new Date(),
): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(
    SEASONAL_STATE_COOKIE,
    seasonalStateCookieValue(currentSeasonalPeriod(now), choice.enabled),
    { ...COOKIE_OPTIONS, secure },
  );
  if (choice.density !== null) {
    cookieStore.set(SEASONAL_DENSITY_COOKIE, choice.density, { ...COOKIE_OPTIONS, secure });
  }
}
