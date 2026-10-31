/**
 * Politique de rate limiting (§6.1) : 5 échecs par fenêtre de 15 min, puis
 * blocage avec délai croissant (15 min, 30 min, 1 h… plafonné à 24 h).
 *
 * Fonctions pures : l'état est lu et écrit par l'appelant (table `rate_limit`,
 * étape 4), dans une transaction qui verrouille la ligne. Le temps est passé
 * en paramètre pour rester testable.
 */

export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_BASE_DELAY_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_DELAY_MS = 24 * 60 * 60 * 1000;
/** Au-delà de ce délai sans activité, les blocages passés sont oubliés. */
export const RATE_LIMIT_MEMORY_MS = 24 * 60 * 60 * 1000;

/** Reflet d'une ligne de la table `rate_limit` (sans la clé). */
export type RateLimitState = {
  /** Échecs dans la fenêtre courante. */
  attempts: number;
  /** Nombre de blocages successifs, qui détermine la durée du prochain. */
  strikes: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

/** Durée du blocage après le n-ième blocage successif (doublement, plafonné). */
export function getBlockDelayMs(strikes: number): number {
  const exponent = Math.max(strikes - 1, 0);
  return Math.min(RATE_LIMIT_BASE_DELAY_MS * 2 ** exponent, RATE_LIMIT_MAX_DELAY_MS);
}

/** Secondes restantes avant la fin du blocage (0 si non bloqué), arrondies au-dessus. */
export function getRetryAfterSeconds(state: RateLimitState | null, now: Date): number {
  if (state?.blockedUntil == null) {
    return 0;
  }
  const remainingMs = state.blockedUntil.getTime() - now.getTime();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/** Vrai si la dernière activité est assez ancienne pour oublier les blocages passés. */
function isForgotten(state: RateLimitState, now: Date): boolean {
  const lastActivity = Math.max(
    state.windowStartedAt.getTime(),
    state.blockedUntil?.getTime() ?? 0,
  );
  return now.getTime() - lastActivity >= RATE_LIMIT_MEMORY_MS;
}

/**
 * Enregistre un échec et renvoie le nouvel état à persister.
 * L'appelant vérifie `getRetryAfterSeconds` AVANT de tenter l'opération ;
 * si un blocage est actif malgré tout, l'état est renvoyé inchangé.
 * Sur un succès, l'appelant supprime simplement la ligne.
 */
export function recordFailure(state: RateLimitState | null, now: Date): RateLimitState {
  const current: RateLimitState =
    state === null || isForgotten(state, now)
      ? { attempts: 0, strikes: 0, windowStartedAt: now, blockedUntil: null }
      : state;

  if (getRetryAfterSeconds(current, now) > 0) {
    return current;
  }

  const windowExpired = now.getTime() - current.windowStartedAt.getTime() >= RATE_LIMIT_WINDOW_MS;
  const attempts = (windowExpired ? 0 : current.attempts) + 1;

  if (attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    const strikes = current.strikes + 1;
    return {
      attempts: 0,
      strikes,
      windowStartedAt: now,
      blockedUntil: new Date(now.getTime() + getBlockDelayMs(strikes)),
    };
  }

  return {
    attempts,
    strikes: current.strikes,
    windowStartedAt: windowExpired ? now : current.windowStartedAt,
    blockedUntil: null,
  };
}