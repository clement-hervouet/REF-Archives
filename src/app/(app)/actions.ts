"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signOut } from "@/server/auth/auth";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { toParisIsoDate } from "@/lib/dates";
import { getCurrentUser, requireUser } from "@/server/auth/session";
import { acknowledgementWeek } from "@/server/home/availability-reminder";
import { setAvailabilityAckWeek } from "@/server/db/reminders";
import { getDb } from "@/server/db/pool";
import { revokeSession } from "@/server/db/sessions";

/** Révoque la session en base, puis supprime le cookie et redirige vers /login. */
export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user !== null) {
    await revokeSession(getDb(), user.sessionId);
    await recordSecurityEvent({
      type: "logout",
      userId: user.id,
      ip: getClientIp(await headers()),
    });
  }
  await signOut({ redirectTo: "/login" });
}

/**
 * « C'est fait pour cette semaine » : masque le rappel des indisponibilités jusqu'au lundi
 * suivant. La semaine est calculée côté serveur (jour de Paris), jamais lue dans le formulaire.
 */
export async function acknowledgeAvailabilityAction(): Promise<void> {
  const user = await requireUser();
  await setAvailabilityAckWeek(getDb(), user.id, acknowledgementWeek(toParisIsoDate(new Date())));
  revalidatePath("/");
}

/** Annule la validation de la semaine : le rappel réapparaît sur l'accueil. */
export async function undoAvailabilityAcknowledgementAction(): Promise<void> {
  const user = await requireUser();
  await setAvailabilityAckWeek(getDb(), user.id, null);
  revalidatePath("/");
}
