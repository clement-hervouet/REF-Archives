/**
 * Règles d'accès, sous forme de fonctions pures (testées sans base ni Auth.js).
 */
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { CurrentUser } from "./current-user";

/**
 * Exige un administrateur : `UnauthorizedError` si personne n'est connecté,
 * `ForbiddenError` si l'utilisateur n'a pas le rôle `admin`.
 */
export function assertAdmin(user: CurrentUser | null): CurrentUser {
  if (user === null) {
    throw new UnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new ForbiddenError();
  }
  return user;
}