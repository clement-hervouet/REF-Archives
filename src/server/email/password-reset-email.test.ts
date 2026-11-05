import { describe, expect, it } from "vitest";
import { EmailDeliveryError } from "@/lib/errors";
import type { EmailMessage } from "@/lib/schemas/email";
import {
  buildPasswordResetEmail,
  passwordResetPath,
  sendPasswordResetEmail,
} from "./password-reset-email";

const input = {
  email: "arbitre@example.com",
  token: "tok_ABC-123",
  appUrl: "https://ref.example.com",
};
const LINK = "https://ref.example.com/reset-password/tok_ABC-123";

function recorder(): { sent: EmailMessage[]; send: (message: EmailMessage) => Promise<void> } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    send: (message) => {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

describe("passwordResetPath", () => {
  it("construit le chemin de la page de nouveau mot de passe", () => {
    expect(passwordResetPath("abc")).toBe("/reset-password/abc");
  });
});

describe("buildPasswordResetEmail", () => {
  it("cible le compte avec un sujet fixe", () => {
    const message = buildPasswordResetEmail(input);
    expect(message.to).toBe("arbitre@example.com");
    expect(message.subject).toBe("Réinitialisation de votre mot de passe REF-Archives");
  });

  it("met le lien complet (APP_URL + jeton) dans le texte et le HTML", () => {
    const message = buildPasswordResetEmail(input);
    expect(message.text).toContain(LINK);
    expect(message.html).toContain(`href="${LINK}"`);
  });

  it("ne met jamais le jeton dans le sujet", () => {
    expect(buildPasswordResetEmail(input).subject).not.toContain("tok_ABC-123");
  });

  it("indique la durée de validité de 30 minutes", () => {
    expect(buildPasswordResetEmail(input).text).toContain("30 minutes");
  });
});

describe("sendPasswordResetEmail", () => {
  it("envoie l'email et renvoie true", async () => {
    const { sent, send } = recorder();
    const ok = await sendPasswordResetEmail(
      { send, appUrl: input.appUrl, onError: () => undefined },
      { email: input.email, token: input.token },
    );
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain(LINK);
  });

  it("renvoie false sans lever d'erreur si l'envoi échoue, et ne transmet que le nom de l'erreur", async () => {
    const errors: string[] = [];
    const ok = await sendPasswordResetEmail(
      {
        send: () => Promise.reject(new EmailDeliveryError("arbitre@example.com tok_ABC-123")),
        appUrl: input.appUrl,
        onError: (name) => errors.push(name),
      },
      { email: input.email, token: input.token },
    );
    expect(ok).toBe(false);
    expect(errors).toEqual(["EmailDeliveryError"]);
  });

  it("renvoie false si l'URL de l'application est inutilisable", async () => {
    const { sent, send } = recorder();
    const errors: string[] = [];
    const ok = await sendPasswordResetEmail(
      { send, appUrl: "ftp://ref.example.com", onError: (name) => errors.push(name) },
      { email: input.email, token: input.token },
    );
    expect(ok).toBe(false);
    expect(sent).toHaveLength(0);
    expect(errors).toEqual(["ValidationError"]);
  });
});
