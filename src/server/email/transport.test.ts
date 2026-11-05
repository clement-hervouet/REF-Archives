import type Mail from "nodemailer/lib/mailer";
import { describe, expect, it } from "vitest";
import { EmailDeliveryError, ValidationError } from "../../lib/errors";
import { buildTransportOptions, deliverEmail, describeSmtpError } from "./transport";
import type { MailSender } from "./transport";

const message = { to: "arbitre@example.com", subject: "Bonjour", text: "Contenu" };

function recordingSender(): { sender: MailSender; sent: Mail.Options[] } {
  const sent: Mail.Options[] = [];
  const sender: MailSender = {
    sendMail: (options) => {
      sent.push(options);
      return Promise.resolve();
    },
  };
  return { sender, sent };
}

describe("buildTransportOptions", () => {
  const relay = { host: "localhost", port: 25, secure: false };

  it("sans authentification : pas d'auth, STARTTLS non imposé", () => {
    const options = buildTransportOptions(relay);
    expect(options.requireTLS).toBe(false);
    expect(options).not.toHaveProperty("auth");
  });

  it("avec authentification et sans TLS implicite : STARTTLS imposé", () => {
    const options = buildTransportOptions({ ...relay, auth: { user: "u", password: "p" } });
    expect(options.requireTLS).toBe(true);
    expect(options.auth).toEqual({ user: "u", pass: "p" });
  });

  it("avec authentification et TLS implicite : requireTLS inutile", () => {
    const options = buildTransportOptions({
      ...relay,
      secure: true,
      auth: { user: "u", password: "p" },
    });
    expect(options.secure).toBe(true);
    expect(options.requireTLS).toBe(false);
  });

  it("pose des timeouts et une version TLS minimale", () => {
    const options = buildTransportOptions(relay);
    expect(options.connectionTimeout).toBeGreaterThan(0);
    expect(options.socketTimeout).toBeGreaterThan(0);
    expect(options.tls).toEqual({ minVersion: "TLSv1.2" });
  });
});

describe("deliverEmail", () => {
  it("envoie avec l'expéditeur fourni", async () => {
    const { sender, sent } = recordingSender();
    await deliverEmail(sender, "REF <no-reply@example.com>", message);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: "REF <no-reply@example.com>",
      to: "arbitre@example.com",
      subject: "Bonjour",
      text: "Contenu",
    });
  });

  it("n'inclut la clé html que si elle est fournie", async () => {
    const { sender, sent } = recordingSender();
    await deliverEmail(sender, "no-reply@example.com", message);
    await deliverEmail(sender, "no-reply@example.com", { ...message, html: "<p>x</p>" });
    expect(sent[0]).not.toHaveProperty("html");
    expect(sent[1]).toMatchObject({ html: "<p>x</p>" });
  });

  it("refuse un message invalide sans rien envoyer", async () => {
    const { sender, sent } = recordingSender();
    await expect(
      deliverEmail(sender, "no-reply@example.com", { ...message, subject: "a\r\nBcc: x@y.z" }),
    ).rejects.toThrow(ValidationError);
    expect(sent).toHaveLength(0);
  });

  it("ne met pas le contenu du message dans l'erreur de validation", async () => {
    const { sender } = recordingSender();
    await expect(
      deliverEmail(sender, "no-reply@example.com", { ...message, to: "secret@pas-valide" }),
    ).rejects.not.toThrow(/secret@pas-valide/);
  });

  it("enveloppe l'échec du transport dans EmailDeliveryError", async () => {
    const original = new Error("boom");
    const sender: MailSender = { sendMail: () => Promise.reject(original) };
    const error = await deliverEmail(sender, "no-reply@example.com", message).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error instanceof Error ? error.cause : undefined).toBe(original);
  });
});

describe("describeSmtpError", () => {
  it("retourne les codes de la cause", () => {
    const cause = Object.assign(new Error("x"), { code: "ECONNREFUSED", responseCode: 550 });
    const error = new EmailDeliveryError("échec", { cause });
    expect(describeSmtpError(error)).toBe("code=ECONNREFUSED responseCode=550");
  });

  it("ne reprend jamais le message (qui peut contenir une adresse)", () => {
    const cause = new Error("Can't send mail to arbitre@example.com");
    const error = new EmailDeliveryError("échec", { cause });
    expect(describeSmtpError(error)).not.toContain("arbitre@example.com");
    expect(describeSmtpError(error)).toBe("erreur inconnue");
  });
});
