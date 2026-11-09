/**
 * Suppression de son propre compte (bloc 11, RGPD §6.5). Ni Next.js ni session ici :
 * l'appelant a vérifié la session (§6.2) et passe le compte connecté.
 *
 * Même mécanique que la suppression par un admin (bloc 10) : le compte est coupé tout de
 * suite, toutes ses sessions sont fermées, et la purge planifiée l'efface avec ses données
 * au bout de `ACCOUNT_DELETION_DELAY_DAYS` jours. Seul un admin peut annuler d'ici là.
 *
 * Garde-fous :
 *  - le mot de passe actuel est exigé : une session volée ne suffit pas ;
 *  - chaque tentative est comptée AVANT la vérification (rate limiting, comme la connexion),
 *    par compte et par IP : la page ne sert pas à deviner le mot de passe ;
 *  - le dernier admin actif ne peut pas supprimer son compte.
 */
import { ACCOUNT_DELETION_DELAY_DAYS, selfDeletionSchema } from "@/lib/schemas/accounts";
import { wouldLeaveNoAdmin } from "../admin/manage-accounts";
import { lockAccount, scheduleAccountDeletion } from "../db/accounts";
import { revokeAllUserSessions } from "../db/sessions";
import type { Queryable, UserCredentials } from "../db/users";
import { hashIdentifier } from "../auth/rate-limit";
import type { AttemptDecision } from "../auth/rate-limit";

type Transaction = <T>(action: (db: Queryable) => Promise<T>) => Promise<T>;

export type SelfDeletionDeps = {
  transaction: Transaction;
  now: () => Date;
  /** Compte la tentative d'avance et dit si elle est admise (voir `rate-limit.ts`). */
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  findCredentials: (email: string) => Promise<UserCredentials | null>;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
};

export type SelfDeletionResult =
  | { status: "invalid" }
  | { status: "rate_limited"; retryAfterMinutes: number }
  | { status: "wrong_password" }
  | { status: "last_admin" }
  | { status: "not_found" }
  | { status: "scheduled"; dueAt: Date; email: string };

/** Clés de rate limiting, hachées comme celles de la connexion (jamais d'IP en clair). */
export function selfDeletionKeys(userId: string, ip: string): string[] {
  return [
    `account-deletion:user:${hashIdentifier(userId)}`,
    `account-deletion:ip:${hashIdentifier(ip)}`,
  ];
}

/** Programme la suppression du compte connecté, après vérification de son mot de passe. */
export async function handleSelfDeletion(
  deps: SelfDeletionDeps,
  user: { id: string; email: string },
  ip: string,
  formData: FormData,
): Promise<SelfDeletionResult> {
  const parsed = selfDeletionSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { status: "invalid" };
  }
  const admission = await deps.admitAttempt(selfDeletionKeys(user.id, ip), deps.now());
  if (!admission.admitted) {
    return {
      status: "rate_limited",
      retryAfterMinutes: Math.max(1, Math.ceil(admission.retryAfterSeconds / 60)),
    };
  }
  // Hors transaction : argon2 prend environ 100 ms, aucun verrou n'est tenu pendant ce temps.
  const credentials = await deps.findCredentials(user.email);
  if (credentials?.userId !== user.id) {
    return { status: "not_found" };
  }
  if (!(await deps.verifyPassword(credentials.passwordHash, parsed.data.password))) {
    return { status: "wrong_password" };
  }
  return deps.transaction((db) => schedule(db, deps.now(), user.id));
}

async function schedule(db: Queryable, now: Date, userId: string): Promise<SelfDeletionResult> {
  const account = await lockAccount(db, userId);
  if (account === null) {
    return { status: "not_found" };
  }
  if (account.state.deletionDueAt !== null) {
    // Déjà programmée (double clic, deux onglets) : la date ne recule pas.
    return { status: "scheduled", dueAt: account.state.deletionDueAt, email: account.email };
  }
  if (await wouldLeaveNoAdmin(db, account, now)) {
    return { status: "last_admin" };
  }
  const dueAt = await scheduleAccountDeletion(db, {
    accountId: userId,
    days: ACCOUNT_DELETION_DELAY_DAYS,
  });
  if (dueAt === null) {
    return { status: "not_found" };
  }
  await revokeAllUserSessions(db, userId, null);
  return { status: "scheduled", dueAt, email: account.email };
}
