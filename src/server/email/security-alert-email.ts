/**
 * Emails d'alerte de sécurité (§9) : mot de passe modifié, connexions suspendues.
 *
 * Règles (§6.6) : jamais de mot de passe ni de jeton. Pas non plus de lien : un lien dans
 * une alerte est le schéma classique de l'hameçonnage, on renvoie vers « Mot de passe
 * oublié ? » par son nom. Les alertes sont obligatoires (pas de désactivation, §9).
 */
import { fr } from "@/i18n/fr";
import type { EmailMessage } from "@/lib/schemas/email";
import { renderEmail } from "./layout";

const passwordChanged = fr.email.passwordChanged;
const accountLocked = fr.email.accountLocked;

/** Alerte envoyée après un changement de mot de passe. */
export function buildPasswordChangedEmail(input: { email: string }): EmailMessage {
  const { text, html } = renderEmail({
    title: passwordChanged.title,
    paragraphs: [passwordChanged.body, passwordChanged.advice],
    footer: fr.email.securityFooter,
  });
  return { to: input.email, subject: passwordChanged.subject, text, html };
}

/** Alerte envoyée quand les connexions au compte sont suspendues (`minutes` ≥ 1). */
export function buildAccountLockedEmail(input: { email: string; minutes: number }): EmailMessage {
  const { text, html } = renderEmail({
    title: accountLocked.title,
    paragraphs: [
      accountLocked.body.replace("{minutes}", String(input.minutes)),
      accountLocked.advice,
    ],
    footer: fr.email.securityFooter,
  });
  return { to: input.email, subject: accountLocked.subject, text, html };
}

export type SecurityAlertDeps = {
  send: (message: EmailMessage) => Promise<void>;
  /** Reçoit uniquement le NOM de l'erreur : son message pourrait contenir l'adresse. */
  onError: (errorName: string) => void;
};

/** Envoie l'alerte construite par `build`. Renvoie `false` en cas d'échec, sans jamais lever. */
async function trySend(deps: SecurityAlertDeps, build: () => EmailMessage): Promise<boolean> {
  try {
    await deps.send(build());
    return true;
  } catch (error: unknown) {
    deps.onError(error instanceof Error ? error.name : "UnknownError");
    return false;
  }
}

export function sendPasswordChangedAlert(
  deps: SecurityAlertDeps,
  input: { email: string },
): Promise<boolean> {
  return trySend(deps, () => buildPasswordChangedEmail(input));
}

export function sendAccountLockedAlert(
  deps: SecurityAlertDeps,
  input: { email: string; minutes: number },
): Promise<boolean> {
  return trySend(deps, () => buildAccountLockedEmail(input));
}
