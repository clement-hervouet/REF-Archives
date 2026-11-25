/**
 * Formulaires de la préparation partagée : lecture du FormData, validation, puis service.
 * Ni Next.js ni authentification ici (§6.2) : l'identifiant du compte connecté est passé
 * par la Server Action, jamais lu dans le formulaire.
 *
 * Champs HTML : `gameId`, `personId` (fiche collègue du propriétaire), `intent` (partage),
 * `ownerId` (propriétaire dont le destinataire se délie), `token` et `reverse` (« none »,
 * « create » ou identifiant d'une fiche collègue du destinataire) pour accepter un lien.
 */
import { z } from "zod";
import { readText } from "@/lib/form-data";
import type { PreparationFormState } from "../games/preparation-form";
import { parsePreparationSave } from "../games/preparation-form";
import { acceptShareLink } from "./accept-share-link";
import type { AcceptShareDeps, AcceptShareResult, ReverseLink } from "./accept-share-link";
import {
  createLink,
  leaveSharedPreparation,
  revokeLink,
  shareWithColleague,
  stopSharing,
  unlinkColleague,
  unlinkFromOwner,
} from "./manage-sharing";
import type { ShareLinkDeps, SharingDeps } from "./manage-sharing";
import { saveSharedPreparation } from "./recipient-preparation";

const idSchema = z.uuid();

const SHARE_INTENTS = ["share", "link", "revoke", "stop"] as const;
const intentSchema = z.enum(SHARE_INTENTS);

export type ShareState =
  | { status: "idle" }
  | {
      status:
        | "shared"
        | "stopped"
        | "revoked"
        | "not_found"
        | "not_linked"
        | "already_linked"
        | "limit_reached";
    }
  /** Lien à envoyer : affiché une seule fois. `expiresAt` en ISO. */
  | { status: "link_created"; url: string; expiresAt: string };

/** Panneau « Partage » du propriétaire : un formulaire par arbitre, `intent` dit quoi faire. */
export async function handleShare(
  deps: ShareLinkDeps,
  ownerUserId: string,
  formData: FormData,
): Promise<ShareState> {
  const gameId = idSchema.safeParse(readText(formData, "gameId"));
  const personId = idSchema.safeParse(readText(formData, "personId"));
  const intent = intentSchema.safeParse(readText(formData, "intent"));
  if (!gameId.success || !personId.success || !intent.success) {
    return { status: "not_found" };
  }
  const input = { gameId: gameId.data, personId: personId.data };
  switch (intent.data) {
    case "share":
      return shareWithColleague(deps, ownerUserId, input);
    case "link": {
      const result = await createLink(deps, ownerUserId, input);
      return result.status === "link_created"
        ? { status: "link_created", url: result.url, expiresAt: result.expiresAt.toISOString() }
        : result;
    }
    case "revoke":
      return revokeLink(deps, ownerUserId, input);
    case "stop":
      return stopSharing(deps, ownerUserId, input);
  }
}

/** Enregistre la préparation d'un match partagé, pour le destinataire connecté. */
export async function handleSaveSharedPreparation(
  deps: SharingDeps,
  viewerId: string,
  formData: FormData,
): Promise<PreparationFormState> {
  const save = parsePreparationSave(formData);
  if ("status" in save) {
    return save;
  }
  return saveSharedPreparation(deps, viewerId, save.gameId, save);
}

export type LeaveShareState = { status: "idle" | "left" | "not_found" };

/** Le destinataire quitte le partage du match désigné par `gameId`. */
export async function handleLeaveShare(
  deps: SharingDeps,
  viewerId: string,
  formData: FormData,
): Promise<LeaveShareState> {
  const gameId = idSchema.safeParse(readText(formData, "gameId"));
  if (!gameId.success) {
    return { status: "not_found" };
  }
  return leaveSharedPreparation(deps, viewerId, gameId.data);
}

export type UnlinkState = { status: "idle" | "unlinked" | "not_found" };

/**
 * Le propriétaire délie la fiche collègue `personId`. Renvoie aussi le compte qui était
 * lié, pour le journal de sécurité.
 */
export async function handleUnlinkColleague(
  deps: SharingDeps,
  ownerUserId: string,
  formData: FormData,
): Promise<UnlinkState & { linkedUserId?: string }> {
  const personId = idSchema.safeParse(readText(formData, "personId"));
  if (!personId.success) {
    return { status: "not_found" };
  }
  const linkedUserId = await unlinkColleague(deps, ownerUserId, personId.data);
  return linkedUserId === null ? { status: "not_found" } : { status: "unlinked", linkedUserId };
}

/** Le destinataire se délie du propriétaire `ownerId`. */
export async function handleUnlinkFromOwner(
  deps: SharingDeps,
  viewerId: string,
  formData: FormData,
): Promise<UnlinkState & { ownerUserId?: string }> {
  const ownerId = idSchema.safeParse(readText(formData, "ownerId"));
  if (!ownerId.success) {
    return { status: "not_found" };
  }
  const unlinked = await unlinkFromOwner(deps, viewerId, ownerId.data);
  return unlinked ? { status: "unlinked", ownerUserId: ownerId.data } : { status: "not_found" };
}

/** `reverse` : « none », « create » ou identifiant de fiche ; toute autre valeur vaut « none ». */
function readReverse(formData: FormData): ReverseLink {
  const value = readText(formData, "reverse");
  if (value === "create") {
    return { kind: "create" };
  }
  const personId = idSchema.safeParse(value);
  return personId.success ? { kind: "existing", personId: personId.data } : { kind: "none" };
}

/** Accepte le lien de partage du champ caché `token`, pour le compte connecté. */
export async function handleAcceptShare(
  deps: AcceptShareDeps,
  viewerId: string,
  formData: FormData,
): Promise<AcceptShareResult> {
  return acceptShareLink(deps, {
    token: readText(formData, "token") ?? "",
    viewerId,
    reverse: readReverse(formData),
  });
}
