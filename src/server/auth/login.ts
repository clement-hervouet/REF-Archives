/**
 * Logique de connexion par email et mot de passe. Les dépendances (base, hash,
 * horloge) sont injectées : la fonction se teste sans base ni argon2.
 */
import { loginKeys } from "./rate-limit";
import type { AttemptDecision } from "./rate-limit";
import type { UserCredentials } from "../db/users";

export type LoginDeps = {
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  findCredentials: (email: string) => Promise<UserCredentials | null>;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
  verifyAgainstDummyHash: (password: string) => Promise<false>;
  clearAttempts: (key: string) => Promise<void>;
  createSession: (userId: string) => Promise<{ id: string }>;
  now: () => Date;
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

  const credentials = await deps.findCredentials(attempt.email);
  const passwordIsValid =
    credentials === null
      ? await deps.verifyAgainstDummyHash(attempt.password)
      : await deps.verifyPassword(credentials.passwordHash, attempt.password);

  if (credentials === null || !passwordIsValid) {
    return { status: "invalid_credentials" };
  }

  // Seul le compteur du compte est effacé : effacer celui de l'IP permettrait à un
  // attaquant de le remettre à zéro en se connectant à son propre compte.
  await deps.clearAttempts(accountKey);
  const session = await deps.createSession(credentials.userId);
  return { status: "success", userId: credentials.userId, sessionId: session.id };
}