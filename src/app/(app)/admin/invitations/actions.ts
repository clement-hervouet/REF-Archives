"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailSchema } from "@/lib/schemas/auth";
import { createInvitationDeps } from "@/server/auth/invitation-deps";
import { createInvitationForEmail } from "@/server/auth/invitations";
import { requireAdmin } from "@/server/auth/session";
import { revokeInvitation } from "@/server/db/invitations";
import { getDb } from "@/server/db/pool";

const INVITATIONS_PATH = "/admin/invitations";

export type CreateInvitationFormState =
  | { status: "idle" }
  | { status: "invalid_email" }
  | { status: "email_taken" }
  | {
      status: "created";
      email: string;
      /** Chemin relatif : le navigateur y ajoute l'origine du site. */
      path: string;
      /** Date ISO (UTC) : mise en forme côté affichage. */
      expiresAt: string;
    };

/** Crée une invitation. Réservé aux administrateurs. Le jeton n'est renvoyé qu'ici, une seule fois. */
export async function createInvitationAction(
  _previous: CreateInvitationFormState,
  formData: FormData,
): Promise<CreateInvitationFormState> {
  const admin = await requireAdmin();

  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    return { status: "invalid_email" };
  }

  const result = await createInvitationForEmail(createInvitationDeps(), {
    email: email.data,
    invitedBy: admin.id,
  });
  if (result.status === "email_taken") {
    return { status: "email_taken" };
  }

  revalidatePath(INVITATIONS_PATH);
  return {
    status: "created",
    email: email.data,
    path: `/invitation/${result.token}`,
    expiresAt: result.expiresAt.toISOString(),
  };
}

/** Révoque une invitation de l'administrateur connecté (la propriété est vérifiée en SQL). */
export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const invitationId = z.uuid().safeParse(formData.get("invitationId"));
  if (!invitationId.success) {
    return;
  }
  await revokeInvitation(getDb(), invitationId.data, admin.id);
  revalidatePath(INVITATIONS_PATH);
}