/**
 * Acceptation d'un lien de partage (migration 035) par le collègue qui l'a reçu, connecté :
 * dans une seule transaction, sa fiche chez le propriétaire est liée à son compte, la
 * préparation du match lui est partagée et le lien est consommé. En option, il associe le
 * propriétaire à l'une de ses fiches collègue (ou en crée une) pour lui partager à son tour.
 *
 * Même réponse « invalide » pour un lien inconnu, expiré, déjà utilisé, révoqué, ou dont le
 * match n'est plus partageable (§6.1). Les tentatives sont limitées par compte et par jeton.
 */
import { tokenSchema } from "@/lib/schemas/auth";
import {
  checkLink,
  findAccountName,
  insertLink,
  findPendingShareLink,
  markShareLinkAccepted,
} from "../db/colleague-links";
import { insertColleague } from "../db/persons";
import { insertShare, lockShareTarget } from "../db/shared-preparations";
import type { Queryable, Transaction } from "../db/users";
import { hashIdentifier } from "../auth/rate-limit";
import type { AttemptDecision } from "../auth/rate-limit";
import { hashToken } from "../auth/tokens";

export type AcceptShareDeps = {
  transaction: Transaction;
  admitAttempt: (keys: string[], now: Date) => Promise<AttemptDecision>;
  now: () => Date;
};

/** Association facultative du propriétaire à une fiche collègue du destinataire. */
export type ReverseLink =
  | { kind: "none" }
  /** Fiche collègue existante du destinataire. */
  | { kind: "existing"; personId: string }
  /** Nouvelle fiche, au prénom et au nom du compte du propriétaire. */
  | { kind: "create" };

export type AcceptShareResult =
  | {
      status: "accepted";
      gameId: string;
      ownerUserId: string;
      /** Vrai si cette acceptation a créé le lien entre les comptes (journal de sécurité). */
      newlyLinked: boolean;
    }
  | { status: "invalid" }
  /** Le propriétaire ouvre son propre lien. */
  | { status: "own_link" }
  /** Fiche déjà liée à un autre compte, ou compte déjà lié à une autre fiche du propriétaire. */
  | { status: "taken" }
  | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * Associe le propriétaire à une fiche collègue du destinataire, au mieux : un refus
 * (fiche déjà liée, limite de collègues) n'empêche pas d'accepter le partage.
 */
async function linkBack(
  db: Queryable,
  input: { viewerId: string; ownerUserId: string; reverse: ReverseLink },
): Promise<void> {
  const { viewerId, ownerUserId, reverse } = input;
  let personId: string | null = null;
  if (reverse.kind === "existing") {
    personId = reverse.personId;
  } else if (reverse.kind === "create") {
    const name = await findAccountName(db, ownerUserId);
    if (name?.lastname == null) {
      return;
    }
    personId = await insertColleague(db, {
      userId: viewerId,
      colleague: { firstname: name.firstname, lastname: name.lastname, hasAccount: true },
    });
  }
  if (personId === null) {
    return;
  }
  const check = await checkLink(db, {
    ownerUserId: viewerId,
    personId,
    linkedUserId: ownerUserId,
  });
  if (check === "free") {
    // Faux si la fiche n'est pas un collègue du destinataire : rien n'est lié.
    await insertLink(db, { ownerUserId: viewerId, personId, linkedUserId: ownerUserId });
  }
}

/** Accepte un lien de partage pour le compte connecté `viewerId`. */
export async function acceptShareLink(
  deps: AcceptShareDeps,
  input: { token: string; viewerId: string; reverse: ReverseLink },
): Promise<AcceptShareResult> {
  const token = tokenSchema.safeParse(input.token);
  if (!token.success) {
    return { status: "invalid" };
  }
  // Clés hachées : jamais de jeton ni d'identifiant en clair dans `rate_limit`.
  const decision = await deps.admitAttempt(
    [`share:user:${hashIdentifier(input.viewerId)}`, `share:token:${hashIdentifier(token.data)}`],
    deps.now(),
  );
  if (!decision.admitted) {
    return { status: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
  }
  const tokenHash = hashToken(token.data);
  return deps.transaction(async (db): Promise<AcceptShareResult> => {
    // Lu sans verrou : il faut d'abord verrouiller le match (même ordre que « Nouveau
    // lien » et le changement d'officiels), puis le lien, relu pour vérifier qu'il n'a pas
    // été consommé ou révoqué entre-temps.
    const link = await findPendingShareLink(db, tokenHash, { lock: false });
    if (link === null) {
      return { status: "invalid" };
    }
    if (link.ownerUserId === input.viewerId) {
      return { status: "own_link" };
    }
    const target = await lockShareTarget(db, {
      gameId: link.gameId,
      ownerUserId: link.ownerUserId,
      personId: link.personId,
    });
    if (target === null) {
      return { status: "invalid" };
    }
    const locked = await findPendingShareLink(db, tokenHash, { lock: true });
    if (locked?.id !== link.id) {
      return { status: "invalid" };
    }
    const linkKey = {
      ownerUserId: link.ownerUserId,
      personId: link.personId,
      linkedUserId: input.viewerId,
    };
    const check = await checkLink(db, linkKey);
    if (check === "taken") {
      return { status: "taken" };
    }
    const newlyLinked = check === "free";
    if (newlyLinked && !(await insertLink(db, linkKey))) {
      return { status: "taken" };
    }
    await insertShare(db, {
      ownerUserId: link.ownerUserId,
      gameId: link.gameId,
      personId: link.personId,
      recipientUserId: input.viewerId,
    });
    await markShareLinkAccepted(db, { linkId: link.id, userId: input.viewerId });
    await linkBack(db, {
      viewerId: input.viewerId,
      ownerUserId: link.ownerUserId,
      reverse: input.reverse,
    });
    return {
      status: "accepted",
      gameId: link.gameId,
      ownerUserId: link.ownerUserId,
      newlyLinked,
    };
  });
}
