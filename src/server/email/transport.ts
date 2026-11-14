/**
 * Transport SMTP (nodemailer) : options, validation et envoi.
 * Imports relatifs avec extension .ts : ce fichier est aussi lancé par scripts/email-test.mts.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { z } from "zod";
import { EmailDeliveryError, ValidationError } from "../../lib/errors.ts";
import { EmailMessageSchema } from "../../lib/schemas/email.ts";
import type { EmailMessage } from "../../lib/schemas/email.ts";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  /** Ne jamais tenter STARTTLS (relais privé sans authentification, voir `SMTP_IGNORE_TLS`). */
  ignoreTls?: boolean;
  auth?: { user: string; password: string };
};

export type SmtpTransport = Transporter<SMTPTransport.SentMessageInfo>;

/** Ce dont `deliverEmail` a besoin d'un transport (facilite les tests). */
export type MailSender = {
  sendMail: (options: Mail.Options) => Promise<unknown>;
};

/** Construit les options nodemailer à partir de la configuration SMTP. */
export function buildTransportOptions(config: SmtpConfig): SMTPTransport.Options {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    // Jamais d'identifiants en clair : avec authentification et sans TLS implicite, STARTTLS est exigé.
    requireTLS: config.auth !== undefined && !config.secure,
    // Défense en profondeur (env.ts l'interdit déjà) : jamais sans STARTTLS avec des identifiants.
    ignoreTLS: config.ignoreTls === true && config.auth === undefined && !config.secure,
    tls: { minVersion: "TLSv1.2" },
    // Un relais qui ne répond pas ne doit pas bloquer une requête indéfiniment.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(config.auth === undefined
      ? {}
      : { auth: { user: config.auth.user, pass: config.auth.password } }),
  };
}

export function createSmtpTransport(config: SmtpConfig): SmtpTransport {
  return nodemailer.createTransport(buildTransportOptions(config));
}

/**
 * Valide puis envoie un email.
 * @throws ValidationError si le message est invalide (rien n'est envoyé).
 * @throws EmailDeliveryError si le transport échoue (erreur d'origine dans `cause`).
 */
export async function deliverEmail(
  sender: MailSender,
  from: string,
  input: EmailMessage,
): Promise<void> {
  const parsed = EmailMessageSchema.safeParse(input);
  if (!parsed.success) {
    // Noms des champs seulement : jamais le contenu (adresses, texte).
    const fields = Object.keys(z.flattenError(parsed.error).fieldErrors).join(", ");
    throw new ValidationError(`Email sortant invalide (${fields}).`);
  }
  const { to, subject, text, html } = parsed.data;
  try {
    await sender.sendMail({
      from,
      to,
      subject,
      text,
      ...(html === undefined ? {} : { html }),
    });
  } catch (error) {
    throw new EmailDeliveryError("L'envoi de l'email a échoué.", { cause: error });
  }
}

/**
 * Résume une erreur SMTP pour les logs : codes uniquement, jamais de message
 * (nodemailer peut y inclure l'adresse du destinataire).
 */
export function describeSmtpError(error: unknown): string {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  const parts: string[] = [];
  if (typeof cause === "object" && cause !== null) {
    if ("code" in cause && typeof cause.code === "string") {
      parts.push(`code=${cause.code}`);
    }
    if ("responseCode" in cause && typeof cause.responseCode === "number") {
      parts.push(`responseCode=${String(cause.responseCode)}`);
    }
  }
  return parts.length > 0 ? parts.join(" ") : "erreur inconnue";
}
