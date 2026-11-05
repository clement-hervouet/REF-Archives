"use server";

/**
 * Server Action du lien d'abonnement iCal (page « Paramètres »). Vérifie la session en
 * base (§6.2) : le lien créé ou révoqué est toujours celui de l'utilisateur connecté.
 * Protection CSRF native des Server Actions.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { SETTINGS_PATH } from "@/lib/app-paths";
import { getEnv } from "@/lib/env";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { requireUser } from "@/server/auth/session";
import { handleManageCalendarFeed } from "@/server/calendar/manage-feed";
import type { CalendarFeedState } from "@/server/calendar/manage-feed";
import { deleteCalendarFeed, replaceCalendarFeed } from "@/server/db/calendar-feeds";
import { getDb } from "@/server/db/pool";

export async function manageCalendarFeedAction(
  _previous: CalendarFeedState,
  formData: FormData,
): Promise<CalendarFeedState> {
  const user = await requireUser();
  const db = getDb();
  const ip = getClientIp(await headers());
  const state = await handleManageCalendarFeed(
    {
      replace: (userId, tokenHash) => replaceCalendarFeed(db, { userId, tokenHash }),
      remove: (userId) => deleteCalendarFeed(db, userId),
      record: (type, userId) => recordSecurityEvent({ type, userId, ip }),
      appUrl: getEnv().APP_URL,
    },
    user.id,
    formData,
  );
  revalidatePath(SETTINGS_PATH);
  return state;
}
