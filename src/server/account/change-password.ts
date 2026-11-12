/**
 * Changement de mot de passe par un utilisateur connecté (écart ASVS V6). Ni Next.js ni
 * session ici : l'appelant a vérifié la session (§6.2) et passe le compte connecté. Les
 * dépendances (transaction, hash, rate limiting) sont injectées : testable sans base.
 *
 * Garde-fous (§6.1) :
 *  - le mot de passe ACTUEL est exigé : une session volée ne suffit pas à le changer ;
 *  - chaque tentative est comptée AVANT la vérification (rate limiting, comme la connexion),
 *    par compte et par IP : le formulaire ne sert pas à deviner le mot de passe ;
 *  - le nouveau mot de passe doit être différent de l'actuel ;
 *  - au succès, toutes les AUTRES sessions sont révoquées ; l'appareil courant reste connecté.
 */
import { readText } from "@/lib/form-data";
import { PASSWORD_MAX_LENGTH, passwordSchema } from "@/lib/schemas/auth";
import { hashIdentifier } from "../auth/rate-limit";
import type { AttemptDecision } from "../auth/rate-limit";
import { revokeAllUserSessions } from "../db/sessions";
import { updateUserPasswordHash } from "../db/users";
import type { Queryable, Transaction, UserCredentials } from "../db/users";

export type ChangePasswordDeps = {
  transaction: Transaction;
  now: () => Date;
  /** Compte la tentative d'avance et dit si elle est admise (voir `rate-limit.ts`). */
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  findCredentials: (email: string) => Promise<UserCredentials | null>;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
  hashPassword: (password: string) => Promise<string>;
};

/** Compte connecté qui change son mot de passe (vient de la session, §6.2). */
export type ChangePasswordUser = {
  id: string;
  email: string;
  /** Session courante, gardée active : seules les autres sont révoquées. */
  sessionId: string;
};

export type ChangePasswordResult =
  /** Mot de passe actuel absent ou mal formé. */
  | { status: "invalid" }
  /** Codes de `passwordSchema` (`password.too_short`…), traduits à l'affichage. */
  | { status: "invalid_password"; issues: string[] }
  | { status: "mismatch" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "wrong_password" }
  | { status: "same_password" }
  | { status: "not_found" }
  /** `email` sert à l'alerte de sécurité « mot de passe modifié ». */
  | { status: "changed"; email: string };

/** Clés de rate limiting, hachées comme la connexion (jamais d'IP ni d'identifiant en clair). */
export function changePasswordKeys(userId: string, ip: string): string[] {
  return [
    `password-change:user:${hashIdentifier(userId)}`,
    `password-change:ip:${hashIdentifier(ip)}`,
  ];
}

/** Change le mot de passe du compte connecté après vérification du mot de passe actuel. */
export async function handleChangePassword(
  deps: ChangePasswordDeps,
  user: ChangePasswordUser,
  ip: string,
  formData: FormData,
): Promise<ChangePasswordResult> {
  // Mot de passe actuel : simple présence attendue (la politique s'applique au NOUVEAU).
  const current = readText(formData, "currentPassword");
  if (current === undefined || current === "" || current.length > PASSWORD_MAX_LENGTH) {
    return { status: "invalid" };
  }
  const parsedNew = passwordSchema.safeParse(readText(formData, "newPassword"));
  if (!parsedNew.success) {
    return { status: "invalid_password", issues: parsedNew.error.issues.map((issue) => issue.message) };
  }
  const newPassword = parsedNew.data;
  if (newPassword !== readText(formData, "confirmation")) {
    return { status: "mismatch" };
  }

  // Tentative comptée AVANT la vérification du mot de passe actuel (comme la connexion).
  const admission = await deps.admitAttempt(changePasswordKeys(user.id, ip), deps.now());
  if (!admission.admitted) {
    return { status: "rate_limited", retryAfterSeconds: admission.retryAfterSeconds };
  }

  // Hors transaction : argon2 prend environ 100 ms, aucun verrou n'est tenu pendant ce temps.
  const credentials = await deps.findCredentials(user.email);
  if (credentials?.userId !== user.id) {
    return { status: "not_found" };
  }
  if (!(await deps.verifyPassword(credentials.passwordHash, current))) {
    return { status: "wrong_password" };
  }
  // Un nouveau mot de passe identique à l'actuel n'a pas d'intérêt : on le refuse (choix de Clem).
  if (await deps.verifyPassword(credentials.passwordHash, newPassword)) {
    return { status: "same_password" };
  }

  const passwordHash = await deps.hashPassword(newPassword);
  return deps.transaction((db) => applyChange(db, user, passwordHash));
}

async function applyChange(
  db: Queryable,
  user: ChangePasswordUser,
  passwordHash: string,
): Promise<ChangePasswordResult> {
  const account = await updateUserPasswordHash(db, user.id, passwordHash);
  if (account === null) {
    return { status: "not_found" };
  }
  // On garde l'appareil courant et on coupe toutes les autres sessions (§6.1, ASVS V6).
  await revokeAllUserSessions(db, user.id, user.sessionId);
  return { status: "changed", email: account.email };
}
