/**
 * Email d'invitation : construction (pure) et envoi qui ne lève jamais d'erreur.
 * L'invitation est déjà créée quand on arrive ici : une panne SMTP ne doit pas faire
 * perdre le lien, que l'admin ne voit qu'une fois.
 */
import { fr } from "@/i18n/fr";
import type { EmailMessage } from "@/lib/schemas/email";
import { INVITATION_TTL_SECONDS } from "@/server/db/invitations";
import { renderEmail } from "./layout";

const t = fr.email.invitation;

/** Chemin de la page d'acceptation : source unique, partagée avec l'affichage du lien à l'admin. */
export function invitationPath(token: string): string {
  return `/invitation/${token}`;
}

export type InvitationEmailInput = {
  email: string;
  token: string;
  /** `APP_URL` validée (jamais l'en-tête Host). */
  appUrl: string;
};

/** Construit l'email d'invitation. Le jeton n'apparaît que dans le lien du corps, jamais dans le sujet. */
export function buildInvitationEmail(input: InvitationEmailInput): EmailMessage {
  const hours = String(INVITATION_TTL_SECONDS / 3600);
  const { text, html } = renderEmail({
    title: t.title,
    paragraphs: [t.body, t.validity.replace("{hours}", hours)],
    action: {
      label: t.action,
      url: `${input.appUrl}${invitationPath(input.token)}`,
      fallback: fr.email.linkFallback,
    },
    footer: t.footer,
  });
  return { to: input.email, subject: t.subject, text, html };
}

export type InvitationEmailDeps = {
  send: (message: EmailMessage) => Promise<void>;
  appUrl: string;
  /** Reçoit uniquement le NOM de l'erreur : son message pourrait contenir l'adresse ou le lien. */
  onError: (errorName: string) => void;
};

/**
 * Envoie l'email d'invitation. Renvoie `false` en cas d'échec, sans jamais lever d'erreur.
 */
export async function sendInvitationEmail(
  deps: InvitationEmailDeps,
  input: { email: string; token: string },
): Promise<boolean> {
  try {
    await deps.send(buildInvitationEmail({ ...input, appUrl: deps.appUrl }));
    return true;
  } catch (error: unknown) {
    deps.onError(error instanceof Error ? error.name : "UnknownError");
    return false;
  }
}
