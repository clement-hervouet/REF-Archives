/**
 * Préparation partagée (migration 035), côté propriétaire et côté destinataire : partager
 * avec un collègue lié, créer ou révoquer un lien de partage, arrêter de partager, délier
 * un collègue, quitter un partage.
 *
 * Ni Next.js ni authentification ici : la Server Action vérifie la session et passe son
 * identifiant (jamais un identifiant venu du formulaire comme propriétaire ou destinataire).
 * Les identifiants de match et de fiche viennent du formulaire : chaque requête vérifie
 * qu'ils appartiennent au propriétaire (`lockShareTarget`, clés composites).
 */
import { sharePath } from "@/lib/app-paths";
import {
  SHARE_LINK_TTL_MS,
  createShareLink,
  deleteLink,
  revokeShareLink,
} from "../db/colleague-links";
import { deleteShare, insertShare, leaveShare, lockShareTarget } from "../db/shared-preparations";
import type { Transaction } from "../db/users";
import type { GeneratedToken } from "../auth/tokens";

export type SharingDeps = { transaction: Transaction };

export type ShareLinkDeps = SharingDeps & {
  generateToken: () => GeneratedToken;
  now: () => Date;
  /** URL publique de l'application, sans « / » final (`APP_URL`). */
  appUrl: string;
};

export type ShareResult =
  | { status: "shared" }
  /** Match introuvable, supprimé, plateau, ou fiche qui n'est pas un collègue arbitre. */
  | { status: "not_found" }
  /** La fiche n'est liée à aucun compte : il faut d'abord un lien de partage. */
  | { status: "not_linked" };

/** Partage la préparation d'un match avec un arbitre dont la fiche est liée à un compte. */
export async function shareWithColleague(
  deps: SharingDeps,
  ownerUserId: string,
  input: { gameId: string; personId: string },
): Promise<ShareResult> {
  return deps.transaction(async (db): Promise<ShareResult> => {
    const target = await lockShareTarget(db, { ownerUserId, ...input });
    if (target === null) {
      return { status: "not_found" };
    }
    if (target.linkedUserId === null) {
      return { status: "not_linked" };
    }
    await insertShare(db, { ownerUserId, ...input, recipientUserId: target.linkedUserId });
    return { status: "shared" };
  });
}

export type CreateLinkResult =
  | {
      status: "link_created";
      /** Lien complet à envoyer ; affiché une seule fois, jamais stocké ni journalisé. */
      url: string;
      expiresAt: Date;
    }
  | { status: "not_found" }
  /** La fiche est déjà liée : partager en un clic, sans lien. */
  | { status: "already_linked" }
  | { status: "limit_reached" };

/**
 * Crée un lien de partage pour un arbitre dont la fiche n'est liée à aucun compte. Le lien
 * en attente précédent (même match, même arbitre) est révoqué.
 */
export async function createLink(
  deps: ShareLinkDeps,
  ownerUserId: string,
  input: { gameId: string; personId: string },
): Promise<CreateLinkResult> {
  const { token, hash } = deps.generateToken();
  const expiresAt = new Date(deps.now().getTime() + SHARE_LINK_TTL_MS);
  return deps.transaction(async (db): Promise<CreateLinkResult> => {
    const target = await lockShareTarget(db, { ownerUserId, ...input });
    if (target === null) {
      return { status: "not_found" };
    }
    if (target.linkedUserId !== null) {
      return { status: "already_linked" };
    }
    const created = await createShareLink(db, {
      ownerUserId,
      ...input,
      tokenHash: hash,
      expiresAt,
    });
    if (!created) {
      return { status: "limit_reached" };
    }
    return { status: "link_created", url: `${deps.appUrl}${sharePath(token)}`, expiresAt };
  });
}

/** Révoque le lien en attente d'un match et d'un arbitre du propriétaire. */
export async function revokeLink(
  deps: SharingDeps,
  ownerUserId: string,
  input: { gameId: string; personId: string },
): Promise<{ status: "revoked" | "not_found" }> {
  const revoked = await deps.transaction((db) => revokeShareLink(db, { ownerUserId, ...input }));
  return { status: revoked ? "revoked" : "not_found" };
}

/** Le propriétaire arrête de partager un match avec un arbitre. */
export async function stopSharing(
  deps: SharingDeps,
  ownerUserId: string,
  input: { gameId: string; personId: string },
): Promise<{ status: "stopped" | "not_found" }> {
  const deleted = await deps.transaction((db) => deleteShare(db, { ownerUserId, ...input }));
  return { status: deleted ? "stopped" : "not_found" };
}

/**
 * Le propriétaire délie une fiche collègue de son compte : tous ses partages avec ce compte
 * sont retirés. Renvoie le compte qui était lié (pour le journal), ou `null`.
 */
export async function unlinkColleague(
  deps: SharingDeps,
  ownerUserId: string,
  personId: string,
): Promise<string | null> {
  return deps.transaction((db) => deleteLink(db, { ownerUserId, personId }));
}

/**
 * Le destinataire se délie d'un propriétaire : celui-ci ne peut plus lui partager de
 * préparation sans nouveau lien. Vrai s'il y avait un lien.
 */
export async function unlinkFromOwner(
  deps: SharingDeps,
  viewerId: string,
  ownerUserId: string,
): Promise<boolean> {
  const linked = await deps.transaction((db) =>
    deleteLink(db, { ownerUserId, linkedUserId: viewerId }),
  );
  return linked !== null;
}

/** Le destinataire quitte le partage d'un match. */
export async function leaveSharedPreparation(
  deps: SharingDeps,
  viewerId: string,
  gameId: string,
): Promise<{ status: "left" | "not_found" }> {
  const left = await deps.transaction((db) => leaveShare(db, { gameId, viewerId }));
  return { status: left ? "left" : "not_found" };
}
