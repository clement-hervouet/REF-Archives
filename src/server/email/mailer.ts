/**
 * Façade d'envoi d'emails pour l'application (serveur uniquement).
 * Les appelants gèrent l'échec : un flux qui doit rester non révélateur (reset de mot de passe)
 * attrape `EmailDeliveryError` et répond comme si l'envoi avait réussi.
 */
import { getEnv } from "@/lib/env";
import { EmailDeliveryError } from "@/lib/errors";
import type { EmailMessage } from "@/lib/schemas/email";
import { createSmtpTransport, deliverEmail, describeSmtpError } from "./transport";
import type { SmtpTransport } from "./transport";

let transport: SmtpTransport | undefined;

/** Transport mémoïsé : un seul pool de connexions pour tout le processus. */
function getTransport(): SmtpTransport {
  if (transport !== undefined) return transport;
  const env = getEnv();
  transport = createSmtpTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ignoreTls: env.SMTP_IGNORE_TLS,
    ...(env.SMTP_USER !== undefined && env.SMTP_PASSWORD !== undefined
      ? { auth: { user: env.SMTP_USER, password: env.SMTP_PASSWORD } }
      : {}),
  });
  return transport;
}

/**
 * Envoie un email avec l'expéditeur configuré (`EMAIL_FROM`).
 * @throws ValidationError si le message est invalide.
 * @throws EmailDeliveryError si l'envoi échoue.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await deliverEmail(getTransport(), getEnv().EMAIL_FROM, message);
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      console.error(`[email] échec d'envoi (${describeSmtpError(error)})`);
    }
    throw error;
  }
}
