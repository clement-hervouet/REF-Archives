/**
 * Envoie un email de test avec la configuration SMTP de .env.local.
 * Usage : pnpm email:test <destinataire>
 */
import { fr } from "../src/i18n/fr.ts";
import { renderEmail } from "../src/server/email/layout.ts";
import {
  createSmtpTransport,
  deliverEmail,
  describeSmtpError,
} from "../src/server/email/transport.ts";

function requireVar(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return value;
}

const to = process.argv[2];
if (to === undefined) {
  console.error("Usage : pnpm email:test <destinataire>");
  process.exit(1);
}

const user = process.env.SMTP_USER;
const password = process.env.SMTP_PASSWORD;

const transport = createSmtpTransport({
  host: requireVar("SMTP_HOST"),
  port: Number.parseInt(requireVar("SMTP_PORT"), 10),
  secure: process.env.SMTP_SECURE === "true",
  ignoreTls: process.env.SMTP_IGNORE_TLS === "true",
  ...(user !== undefined && user !== "" && password !== undefined && password !== ""
    ? { auth: { user, password } }
    : {}),
});

const content = fr.email.test;
const { text, html } = renderEmail({
  title: content.title,
  paragraphs: [content.body],
  action: {
    label: content.action,
    url: process.env.APP_URL ?? "http://localhost:3000",
    fallback: fr.email.linkFallback,
  },
  footer: fr.email.footer,
});

try {
  await deliverEmail(transport, requireVar("EMAIL_FROM"), {
    to,
    subject: content.subject,
    text,
    html,
  });
  console.log("Email envoyé.");
} catch (error) {
  console.error(`Échec de l'envoi (${describeSmtpError(error)}).`);
  process.exitCode = 1;
}
