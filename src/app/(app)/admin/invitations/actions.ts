"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { INVITATIONS_PATH } from "@/lib/app-paths";
import { emailSchema } from "@/lib/schemas/auth";
import { createInviteFromAccessRequestDeps } from "@/server/auth/access-request-deps";
import { inviteFromAccessRequest } from "@/server/auth/access-requests";
import { getClientIp } from "@/server/auth/client-ip";
import { createInvitationDeps } from "@/server/auth/invitation-deps";
import { createInvitationForEmail } from "@/server/auth/invitations";
import { admitAttemptInTransaction } from "@/server/auth/login-deps";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireAdmin } from "@/server/auth/session";
import { decideAccessRequest } from "@/server/db/access-requests";
import { revokeInvitation } from "@/server/db/invitations";
import { getDb } from "@/server/db/pool";
import { invitationPath, sendInvitationEmail } from "@/server/email/invitation-email";
import { sendEmail } from "@/server/email/mailer";
import { emailSendKeys } from "@/server/email/send-limit";

export type CreateInvitationFormState =
  | { status: "idle" }
  | { status: "invalid_email" }
  | { status: "email_taken" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | {
      status: "created";
      email: string;
      /** Chemin relatif : le navigateur y ajoute l'origine du site. */
      path: string;
      /** Date ISO (UTC) : mise en forme côté affichage. */
      expiresAt: string;
      /** `false` si l'email n'a pas pu partir : l'admin transmet alors le lien lui-même. */
      emailSent: boolean;
    };

/** Envoie l'email d'invitation. Renvoie `false` si l'envoi a échoué (jamais d'exception). */
function sendInvitation(email: string, token: string): Promise<boolean> {
  return sendInvitationEmail(
    {
      send: sendEmail,
      appUrl: getEnv().APP_URL,
      onError: (errorName) => {
        console.error(`[invitation] email non envoyé (${errorName})`);
      },
    },
    { email, token },
  );
}

/**
 * Crée une invitation et l'envoie par email. Réservé aux administrateurs.
 * Le jeton n'est renvoyé qu'ici, une seule fois.
 */
export async function createInvitationAction(
  _previous: CreateInvitationFormState,
  formData: FormData,
): Promise<CreateInvitationFormState> {
  const admin = await requireAdmin();

  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    return { status: "invalid_email" };
  }

  // Limite d'envois (§6.6), AVANT la création : un refus n'a aucun effet de bord.
  const ip = getClientIp(await headers());
  const admission = await admitAttemptInTransaction(emailSendKeys(admin.id, ip), new Date());
  if (!admission.admitted) {
    return { status: "rate_limited", retryAfterSeconds: admission.retryAfterSeconds };
  }

  const result = await createInvitationForEmail(createInvitationDeps(), {
    email: email.data,
    invitedBy: admin.id,
  });
  if (result.status === "email_taken") {
    return { status: "email_taken" };
  }

  const emailSent = await sendInvitation(email.data, result.token);

  await recordSecurityEvent({
    type: "invitation_created",
    userId: admin.id,
    ip,
  });
  revalidatePath(INVITATIONS_PATH);
  return {
    status: "created",
    email: email.data,
    path: invitationPath(result.token),
    expiresAt: result.expiresAt.toISOString(),
    emailSent,
  };
}

/** Révoque une invitation de l'administrateur connecté (la propriété est vérifiée en SQL). */
export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const invitationId = z.uuid().safeParse(formData.get("invitationId"));
  if (!invitationId.success) {
    return;
  }
  const revoked = await revokeInvitation(getDb(), invitationId.data, admin.id);
  if (revoked) {
    await recordSecurityEvent({
      type: "invitation_revoked",
      userId: admin.id,
      ip: getClientIp(await headers()),
    });
  }
  revalidatePath(INVITATIONS_PATH);
}

// ─── Demandes d'accès (§15.4.4) ────────────────────────────────────────────

export type AccessRequestActionState =
  | { status: "idle" }
  /** Demande inconnue ou déjà traitée (par un autre admin, par exemple). */
  | { status: "not_found" }
  /** Un compte existe déjà pour cet email : la demande a été retirée. */
  | { status: "email_taken"; email: string }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | {
      status: "created";
      email: string;
      /** Chemin relatif : le navigateur y ajoute l'origine du site. */
      path: string;
      /** Date ISO (UTC) : mise en forme côté affichage. */
      expiresAt: string;
      /** `false` si l'email n'a pas pu partir : l'admin transmet alors le lien lui-même. */
      emailSent: boolean;
    };

/** La liste et la pastille de la navigation (dans le layout) changent toutes les deux. */
function revalidateAccessRequests(): void {
  revalidatePath(INVITATIONS_PATH);
  revalidatePath("/", "layout");
}

/**
 * Invite l'auteur d'une demande d'accès : invitation habituelle (72 h) envoyée par email, et
 * demande close. Réservé aux administrateurs ; même limite d'envois qu'une invitation.
 */
export async function inviteFromAccessRequestAction(
  _previous: AccessRequestActionState,
  formData: FormData,
): Promise<AccessRequestActionState> {
  const admin = await requireAdmin();

  const requestId = z.uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) {
    return { status: "not_found" };
  }

  // Limite d'envois (§6.6), AVANT la création : un refus n'a aucun effet de bord.
  const ip = getClientIp(await headers());
  const admission = await admitAttemptInTransaction(emailSendKeys(admin.id, ip), new Date());
  if (!admission.admitted) {
    return { status: "rate_limited", retryAfterSeconds: admission.retryAfterSeconds };
  }

  const result = await inviteFromAccessRequest(createInviteFromAccessRequestDeps(), {
    requestId: requestId.data,
    adminId: admin.id,
  });
  if (result.status !== "created") {
    revalidateAccessRequests();
    return result;
  }

  const emailSent = await sendInvitation(result.email, result.token);
  await recordSecurityEvent({ type: "invitation_created", userId: admin.id, ip });
  revalidateAccessRequests();
  return {
    status: "created",
    email: result.email,
    path: invitationPath(result.token),
    expiresAt: result.expiresAt.toISOString(),
    emailSent,
  };
}

/** Refuse une demande d'accès : elle quitte la liste, sans email au demandeur (§15.4.4). */
export async function refuseAccessRequestAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const requestId = z.uuid().safeParse(formData.get("requestId"));
  if (!requestId.success) {
    return;
  }
  const refused = await decideAccessRequest(getDb(), {
    requestId: requestId.data,
    adminId: admin.id,
    decision: "refused",
  });
  if (refused) {
    await recordSecurityEvent({
      type: "access_request_refused",
      userId: admin.id,
      ip: getClientIp(await headers()),
    });
  }
  revalidateAccessRequests();
}
