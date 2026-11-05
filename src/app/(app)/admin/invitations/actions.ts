"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { emailSchema } from "@/lib/schemas/auth";
import { getClientIp } from "@/server/auth/client-ip";
import { createInvitationDeps } from "@/server/auth/invitation-deps";
import { createInvitationForEmail } from "@/server/auth/invitations";
import { admitAttemptInTransaction } from "@/server/auth/login-deps";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireAdmin } from "@/server/auth/session";
import { revokeInvitation } from "@/server/db/invitations";
import { getDb } from "@/server/db/pool";
import { invitationPath, sendInvitationEmail } from "@/server/email/invitation-email";
import { sendEmail } from "@/server/email/mailer";
import { emailSendKeys } from "@/server/email/send-limit";

const INVITATIONS_PATH = "/admin/invitations";

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

  const emailSent = await sendInvitationEmail(
    {
      send: sendEmail,
      appUrl: getEnv().APP_URL,
      onError: (errorName) => {
        console.error(`[invitation] email non envoyé (${errorName})`);
      },
    },
    { email: email.data, token: result.token },
  );

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
