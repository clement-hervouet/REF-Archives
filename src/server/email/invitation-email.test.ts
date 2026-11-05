import { describe, expect, it } from "vitest";
import { EmailDeliveryError } from "@/lib/errors";
import type { EmailMessage } from "@/lib/schemas/email";
import { buildInvitationEmail, invitationPath, sendInvitationEmail } from "./invitation-email";

const input = {
  email: "nouveau@example.com",
  token: "tok_ABC-123",
  appUrl: "https://ref.example.com",
};
const LINK = "https://ref.example.com/invitation/tok_ABC-123";

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

describe("invitationPath", () => {
  it("construit le chemin de la page d'acceptation", () => {
    expect(invitationPath("abc")).toBe("/invitation/abc");
  });
});

describe("buildInvitationEmail", () => {
  it("cible la personne invitée avec un sujet fixe", () => {
    const message = buildInvitationEmail(input);
    expect(message.to).toBe("nouveau@example.com");
    expect(message.subject).toBe("Invitation à rejoindre REF-Archives");
  });

  it("met le lien complet (APP_URL + jeton) dans le texte et le HTML", () => {
    const message = buildInvitationEmail(input);
    expect(message.text).toContain(LINK);
    expect(message.html).toContain(`href="${LINK}"`);
  });

  it("ne met jamais le jeton dans le sujet", () => {
    expect(buildInvitationEmail(input).subject).not.toContain("tok_ABC-123");
  });

  it("indique la durée de validité de 72 heures", () => {
    expect(buildInvitationEmail(input).text).toContain("72 heures");
  });
});

describe("sendInvitationEmail", () => {
  it("envoie l'email et renvoie true", async () => {
    const { sent, send } = recorder();
    const ok = await sendInvitationEmail(
      { send, appUrl: input.appUrl, onError: () => undefined },
      { email: input.email, token: input.token },
    );
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain(LINK);
  });

  it("renvoie false sans lever d'erreur si l'envoi échoue, et ne transmet que le nom de l'erreur", async () => {
    const errors: string[] = [];
    const ok = await sendInvitationEmail(
      {
        send: () => Promise.reject(new EmailDeliveryError("nouveau@example.com tok_ABC-123")),
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
    const ok = await sendInvitationEmail(
      { send, appUrl: "ftp://ref.example.com", onError: (name) => errors.push(name) },
      { email: input.email, token: input.token },
    );
    expect(ok).toBe(false);
    expect(sent).toHaveLength(0);
    expect(errors).toEqual(["ValidationError"]);
  });

  it("gère une erreur qui n'est pas une instance d'Error", async () => {
    const errors: string[] = [];
    const ok = await sendInvitationEmail(
      {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        send: () => Promise.reject("texte brut"),
        appUrl: input.appUrl,
        onError: (name) => errors.push(name),
      },
      { email: input.email, token: input.token },
    );
    expect(ok).toBe(false);
    expect(errors).toEqual(["UnknownError"]);
  });
});
