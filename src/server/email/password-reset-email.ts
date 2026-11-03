/**
 * Email de réinitialisation : construction (pure) et envoi qui ne lève jamais d'erreur.
 * Si l'envoi échoue, la réponse à l'utilisateur reste identique (pas d'énumération, §6.1).
 */
import { fr } from "@/i18n/fr";
import type { EmailMessage } from "@/lib/schemas/email";
import { PASSWORD_RESET_TTL_SECONDS } from "@/server/db/password-resets";
import { renderEmail } from "./layout";

const t = fr.email.passwordReset;

/** Chemin de la page de nouveau mot de passe. */
export function passwordResetPath(token: string): string {
  return `/reset-password/${token}`;
}

export type PasswordResetEmailInput = {
  email: string;
  token: string;
  /** `APP_URL` validée (jamais l'en-tête Host). */
  appUrl: string;
};

/** Construit l'email. Le jeton n'apparaît que dans le lien du corps, jamais dans le sujet. */
export function buildPasswordResetEmail(input: PasswordResetEmailInput): EmailMessage {
  const minutes = String(PASSWORD_RESET_TTL_SECONDS / 60);
  const { text, html } = renderEmail({
    title: t.title,
    paragraphs: [t.body, t.validity.replace("{minutes}", minutes)],
    action: {
      label: t.action,
      url: `${input.appUrl}${passwordResetPath(input.token)}`,
      fallback: fr.email.linkFallback,
    },
    footer: t.footer,
  });
  return { to: input.email, subject: t.subject, text, html };
}

export type PasswordResetEmailDeps = {
  send: (message: EmailMessage) => Promise<void>;
  appUrl: string;
  /** Reçoit uniquement le NOM de l'erreur : son message pourrait contenir l'adresse ou le lien. */
  onError: (errorName: string) => void;
};

/** Envoie l'email de reset. Renvoie `false` en cas d'échec, sans jamais lever d'erreur. */
export async function sendPasswordResetEmail(
  deps: PasswordResetEmailDeps,
  input: { email: string; token: string },
): Promise<boolean> {
  try {
    await deps.send(buildPasswordResetEmail({ ...input, appUrl: deps.appUrl }));
    return true;
  } catch (error: unknown) {
    deps.onError(error instanceof Error ? error.name : "UnknownError");
    return false;
  }
}