/**
 * Point d'entrée à utiliser dans les pages, layouts et Server Actions pour savoir
 * qui est connecté. À appeler dans CHAQUE page et CHAQUE action (§6.2) : un layout
 * ne suffit pas, car il n'est pas rendu à nouveau à chaque navigation côté client.
 */
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "../db/pool";
import { auth } from "./auth";
import { assertAdmin } from "./authorization";
import { resolveCurrentUser } from "./current-user";
import type { CurrentUser } from "./current-user";

/** Utilisateur courant ou `null`. Mémoïsé pendant une requête (une seule lecture en base). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  return resolveCurrentUser(getDb(), session?.sessionId);
});

/** Pour les Server Actions et Route Handlers : lève `UnauthorizedError` si personne n'est connecté. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user === null) {
    throw new UnauthorizedError();
  }
  return user;
}

/** Pour les Server Actions et Route Handlers réservés aux administrateurs. */
export async function requireAdmin(): Promise<CurrentUser> {
  return assertAdmin(await getCurrentUser());
}

/** Pour les pages et layouts : redirige vers la page de connexion si personne n'est connecté. */
export async function requireUserOrRedirect(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  return user;
}

/**
 * Pour les pages réservées aux administrateurs : /login si personne n'est connecté,
 * 404 pour un utilisateur simple (on ne confirme pas que la page existe).
 */
export async function requireAdminOrRedirect(): Promise<CurrentUser> {
  const user = await requireUserOrRedirect();
  if (user.role !== "admin") {
    notFound();
  }
  return user;
}