/**
 * Résolution de l'utilisateur courant à partir de l'identifiant de session du JWT.
 * C'est cette vérification en base qui fait foi (§6.2), pas le contenu du cookie.
 */
import { z } from "zod";
import { findActiveSession, touchSession } from "../db/sessions";
import type { Queryable, UserRole } from "../db/users";

export type CurrentUser = {
  id: string;
  sessionId: string;
  email: string;
  role: UserRole;
};

const sessionIdSchema = z.uuid();

/**
 * Renvoie l'utilisateur si la session existe, n'est pas révoquée et n'a pas expiré,
 * sinon `null`. Un identifiant mal formé ne provoque aucun accès à la base.
 */
export async function resolveCurrentUser(
  db: Queryable,
  rawSessionId: unknown,
): Promise<CurrentUser | null> {
  const sessionId = sessionIdSchema.safeParse(rawSessionId);
  if (!sessionId.success) {
    return null;
  }
  const active = await findActiveSession(db, sessionId.data);
  if (active === null) {
    return null;
  }
  await touchSession(db, active.sessionId);
  return {
    id: active.userId,
    sessionId: active.sessionId,
    email: active.email,
    role: active.role,
  };
}