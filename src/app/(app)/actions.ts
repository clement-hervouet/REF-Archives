"use server";

import { headers } from "next/headers";
import { signOut } from "@/server/auth/auth";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";
import { getCurrentUser } from "@/server/auth/session";
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