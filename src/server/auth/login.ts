/**
 * Logique de connexion par email et mot de passe. Les dépendances (base, hash,
 * horloge) sont injectées : la fonction se teste sans base ni argon2.
 */
import { loginKeys } from "./rate-limit";
import type { AttemptDecision } from "./rate-limit";
import type { UserCredentials } from "../db/users";

/** Un compte existant vient d'être bloqué par une tentative de connexion ratée. */
export type AccountBlockedEvent = {
  /** Email normalisé du compte (celui de la tentative, qui correspond à un compte existant). */
  email: string;
  retryAfterSeconds: number;
};

export type LoginDeps = {
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  findCredentials: (email: string) => Promise<UserCredentials | null>;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
  verifyAgainstDummyHash: (password: string) => Promise<false>;
  clearAttempts: (key: string) => Promise<void>;
  createSession: (userId: string) => Promise<{ id: string }>;
  now: () => Date;
  /**
   * Alerte de sécurité (§9). Appelée sans être attendue : l'implémentation ne doit ni
   * lever d'erreur ni bloquer, pour que la réponse ne dépende pas de l'existence du compte.
   */
  onAccountBlocked?: (event: AccountBlockedEvent) => void;
};

export type LoginAttempt = {
  /** Email déjà normalisé (voir `emailSchema`). */
  email: string;
  password: string;
  /** IP du client telle que transmise par le reverse proxy. */
  ip: string;
};

export type LoginResult =
  | { status: "success"; userId: string; sessionId: string }
  | { status: "invalid_credentials" }
  | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * Tente une connexion. Le résultat est identique que l'email existe ou non
 * (§6.1, pas d'énumération), et le temps de calcul aussi (hash factice).
 */
export async function authenticate(deps: LoginDeps, attempt: LoginAttempt): Promise<LoginResult> {
  const { ipKey, accountKey } = loginKeys(attempt.ip, attempt.email);

  // La tentative est comptée avant toute vérification (voir `rate-limit.ts`).
  const decision = await deps.admitAttempt([ipKey, accountKey], deps.now());
  if (!decision.admitted) {
    return { status: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
  }

  // Cette tentative vient-elle de faire basculer le compte en blocage ?
  const accountBlock = decision.newlyBlocked?.find((entry) => entry.key === accountKey);

  const credentials = await deps.findCredentials(attempt.email);
  const passwordIsValid =
    credentials === null
      ? await deps.verifyAgainstDummyHash(attempt.password)
      : await deps.verifyPassword(credentials.passwordHash, attempt.password);

  if (credentials === null || !passwordIsValid) {
    // Alerte seulement si l'échec a déclenché le blocage ET si le compte existe : jamais
    // d'email vers une adresse inconnue. Un succès, lui, efface le blocage (plus bas) :
    // aucune alerte dans ce cas.
    if (credentials !== null && accountBlock !== undefined) {
      deps.onAccountBlocked?.({
        email: attempt.email,
        retryAfterSeconds: accountBlock.retryAfterSeconds,
      });
    }
    return { status: "invalid_credentials" };
  }

  // Seul le compteur du compte est effacé : effacer celui de l'IP permettrait à un
  // attaquant de le remettre à zéro en se connectant à son propre compte.
  await deps.clearAttempts(accountKey);
  const session = await deps.createSession(credentials.userId);
  return { status: "success", userId: credentials.userId, sessionId: session.id };
}
