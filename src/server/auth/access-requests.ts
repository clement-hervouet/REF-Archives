/**
 * Logique métier des demandes d'accès (§15.4.4) : envoi par un visiteur sans compte,
 * invitation par un admin. Les dépendances (base, rate limiting, jeton) sont injectées :
 * testable sans base.
 */
import { emailSchema } from "@/lib/schemas/auth";
import { parseProfile } from "@/lib/schemas/profile";
import type { ProfileIssue } from "@/lib/schemas/profile";
import { decideAccessRequest, lockPendingAccessRequest } from "../db/access-requests";
import type { NewAccessRequest } from "../db/access-requests";
import { createInvitation } from "../db/invitations";
import type { Transaction } from "../db/users";
import { hashIdentifier } from "./rate-limit";
import type { AttemptDecision } from "./rate-limit";
import type { GeneratedToken } from "./tokens";

// ─── Envoi (visiteur) ──────────────────────────────────────────────────────

export type SubmitAccessRequestDeps = {
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  /** Renvoie `false` si la demande a été ignorée (voir `insertAccessRequest`). */
  insert: (request: NewAccessRequest) => Promise<boolean>;
  now: () => Date;
};

export type SubmitAccessRequestInput = {
  email: unknown;
  firstname: unknown;
  lastname: unknown;
  /** IP du client telle que transmise par le reverse proxy. */
  ip: string;
};

export type SubmitAccessRequestResult =
  | {
      status: "requested";
      /** Email normalisé, à rappeler au visiteur. */
      email: string;
      /** Interne (journal) : l'appelant répond pareil que la demande soit créée ou ignorée. */
      created: boolean;
    }
  | { status: "invalid"; emailInvalid: boolean; profileIssues: ProfileIssue[] }
  | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * Enregistre une demande d'accès. Les entrées mal formées sont refusées avant tout accès à
 * la base et ne comptent pas dans le rate limiting. La tentative est comptée AVANT
 * l'insertion, que l'adresse ait un compte ou non : le rate limiting ne révèle rien.
 */
export async function submitAccessRequest(
  deps: SubmitAccessRequestDeps,
  input: SubmitAccessRequestInput,
): Promise<SubmitAccessRequestResult> {
  const email = emailSchema.safeParse(input.email);
  const profile = parseProfile({ firstname: input.firstname, lastname: input.lastname });
  if (!email.success || !profile.success) {
    return {
      status: "invalid",
      emailInvalid: !email.success,
      profileIssues: profile.success ? [] : profile.issues,
    };
  }

  // Clés hachées : jamais d'IP ni d'email en clair dans la table `rate_limit`.
  const decision = await deps.admitAttempt(
    [
      `access-request:ip:${hashIdentifier(input.ip)}`,
      `access-request:account:${hashIdentifier(email.data)}`,
    ],
    deps.now(),
  );
  if (!decision.admitted) {
    return { status: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
  }

  const created = await deps.insert({ email: email.data, ...profile.profile });
  return { status: "requested", email: email.data, created };
}

// ─── Invitation (admin) ────────────────────────────────────────────────────

export type InviteFromAccessRequestDeps = {
  generateToken: () => GeneratedToken;
  transaction: Transaction;
};

export type InviteFromAccessRequestResult =
  | {
      status: "created";
      email: string;
      /** À afficher une seule fois à l'admin ; jamais stocké ni journalisé. */
      token: string;
      expiresAt: Date;
    }
  /** Un compte existe déjà pour cet email : la demande est close (refusée) au passage. */
  | { status: "email_taken"; email: string }
  /** Demande inconnue ou déjà traitée (par un autre admin, par exemple). */
  | { status: "not_found" };

/**
 * Crée l'invitation habituelle (72 h) pour l'email de la demande et clôt la demande, dans la
 * même transaction : une invitation n'existe jamais sans que la demande soit close, et
 * inversement. La demande est verrouillée pendant ce temps.
 */
export async function inviteFromAccessRequest(
  deps: InviteFromAccessRequestDeps,
  input: { requestId: string; adminId: string },
): Promise<InviteFromAccessRequestResult> {
  const { token, hash } = deps.generateToken();
  return deps.transaction(async (db) => {
    const request = await lockPendingAccessRequest(db, input.requestId);
    if (request === null) {
      return { status: "not_found" };
    }
    const invitation = await createInvitation(db, {
      email: request.email,
      tokenHash: hash,
      invitedBy: input.adminId,
    });
    await decideAccessRequest(db, {
      requestId: request.id,
      adminId: input.adminId,
      decision: invitation === null ? "refused" : "invited",
    });
    if (invitation === null) {
      return { status: "email_taken", email: request.email };
    }
    return {
      status: "created",
      email: invitation.email,
      token,
      expiresAt: invitation.expiresAt,
    };
  });
}
