"use server";

import { z } from "zod";
import { getDb } from "@/server/db/pool";
import { revokeSession } from "@/server/db/sessions";
import { auth, signOut } from "@/server/auth/auth";

/** Révoque la session en base, puis supprime le cookie et redirige vers /login. */
export async function logout(): Promise<void> {
  const session = await auth();
  const sessionId = z.uuid().safeParse(session?.sessionId);
  if (sessionId.success) {
    await revokeSession(getDb(), sessionId.data);
  }
  await signOut({ redirectTo: "/login" });
}