/**
 * Rate limiting de la connexion : décision d'admettre ou non une tentative.
 *
 * Chaque tentative admise est comptée D'AVANCE, sous verrou de ligne, avant que le
 * mot de passe soit vérifié : des requêtes parallèles ne peuvent donc pas dépasser
 * la limite. Un succès efface le compteur du compte (voir `login.ts`).
 */
import { createHash } from "node:crypto";
import { getRetryAfterSeconds, recordFailure } from "./rate-limit-policy";
import type { RateLimitState } from "./rate-limit-policy";

/** Accès aux compteurs. Les deux fonctions s'exécutent dans la même transaction. */
export type RateLimitStore = {
  lock: (keys: string[]) => Promise<Map<string, RateLimitState>>;
  save: (key: string, state: RateLimitState) => Promise<void>;
};

/** Clé dont le blocage vient de commencer, avec la durée de ce blocage. */
type BlockedKey = {
  key: string;
  retryAfterSeconds: number;
};

export type AttemptDecision =
  /** `newlyBlocked` n'est présent que si cette tentative a déclenché un blocage. */
  { admitted: true; newlyBlocked?: BlockedKey[] } | { admitted: false; retryAfterSeconds: number };

export type LoginKeys = {
  ipKey: string;
  accountKey: string;
};

/**
 * Empreinte SHA-256 en hexadécimal : les clés de `rate_limit` ne contiennent
 * jamais d'IP ni d'email en clair (§6.5, minimisation).
 */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Clés de rate limiting d'une tentative de connexion. L'email doit être normalisé. */
export function loginKeys(ip: string, email: string): LoginKeys {
  return {
    ipKey: `login:ip:${hashIdentifier(ip)}`,
    accountKey: `login:account:${hashIdentifier(email)}`,
  };
}

/**
 * Décide si la tentative est admise. Si une des clés est bloquée, rien n'est
 * incrémenté (une tentative refusée ne prolonge pas le blocage). Sinon, chaque
 * clé compte la tentative, et celles que cette tentative vient de bloquer sont signalées.
 */
export async function admitAttempt(
  store: RateLimitStore,
  keys: string[],
  now: Date,
): Promise<AttemptDecision> {
  const states = await store.lock(keys);

  const retryAfterSeconds = Math.max(
    0,
    ...keys.map((key) => getRetryAfterSeconds(states.get(key) ?? null, now)),
  );
  if (retryAfterSeconds > 0) {
    return { admitted: false, retryAfterSeconds };
  }

  const newlyBlocked: BlockedKey[] = [];
  for (const key of keys) {
    const next = recordFailure(states.get(key) ?? null, now);
    await store.save(key, next);
    // Aucune clé n'était bloquée avant (sinon on serait sorti plus haut) : un blocage actif
    // dans le nouvel état vient donc de cette tentative.
    const blockedFor = getRetryAfterSeconds(next, now);
    if (blockedFor > 0) {
      newlyBlocked.push({ key, retryAfterSeconds: blockedFor });
    }
  }
  return newlyBlocked.length === 0 ? { admitted: true } : { admitted: true, newlyBlocked };
}
