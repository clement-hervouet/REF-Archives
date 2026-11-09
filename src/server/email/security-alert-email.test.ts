import { describe, expect, it } from "vitest";
import { EmailDeliveryError } from "@/lib/errors";
import type { EmailMessage } from "@/lib/schemas/email";
import {
  buildAccountDeletionScheduledEmail,
  buildEmailChangedEmail,
  buildAccountLockedEmail,
  buildPasswordChangedEmail,
  sendAccountDeletionScheduledAlert,
  sendAccountLockedAlert,
  sendPasswordChangedAlert,
} from "./security-alert-email";

const EMAIL = "arbitre@example.com";

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

describe("buildPasswordChangedEmail", () => {
  it("cible le compte avec un sujet fixe", () => {
    const message = buildPasswordChangedEmail({ email: EMAIL });
    expect(message.to).toBe(EMAIL);
    expect(message.subject).toBe("Votre mot de passe REF-Archives a été modifié");
  });

  it("indique que les sessions ont été fermées et renvoie vers « Mot de passe oublié ? »", () => {
    const { text } = buildPasswordChangedEmail({ email: EMAIL });
    expect(text).toContain("sessions");
    expect(text).toContain("Mot de passe oublié ?");
  });

  it("ne contient aucun lien (anti-hameçonnage, §6.6)", () => {
    const message = buildPasswordChangedEmail({ email: EMAIL });
    expect(message.text).not.toContain("http");
    expect(message.html).not.toContain("<a ");
  });
});

describe("buildAccountLockedEmail", () => {
  it("cible le compte avec un sujet fixe", () => {
    const message = buildAccountLockedEmail({ email: EMAIL, minutes: 15 });
    expect(message.to).toBe(EMAIL);
    expect(message.subject).toBe("Connexions suspendues sur votre compte REF-Archives");
  });

  it("indique la durée de la suspension", () => {
    expect(buildAccountLockedEmail({ email: EMAIL, minutes: 30 }).text).toContain("30 minutes");
  });

  it("ne contient aucun lien ni adresse IP", () => {
    const message = buildAccountLockedEmail({ email: EMAIL, minutes: 15 });
    expect(message.text).not.toContain("http");
    expect(message.html).not.toContain("<a ");
  });
});

describe("sendPasswordChangedAlert / sendAccountLockedAlert", () => {
  it("envoient l'alerte et renvoient true", async () => {
    const { sent, send } = recorder();
    const deps = { send, onError: () => undefined };
    expect(await sendPasswordChangedAlert(deps, { email: EMAIL })).toBe(true);
    expect(await sendAccountLockedAlert(deps, { email: EMAIL, minutes: 15 })).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it("renvoient false sans lever d'erreur si l'envoi échoue, et ne transmettent que le nom de l'erreur", async () => {
    const errors: string[] = [];
    const deps = {
      send: () => Promise.reject(new EmailDeliveryError("arbitre@example.com")),
      onError: (name: string) => errors.push(name),
    };
    expect(await sendPasswordChangedAlert(deps, { email: EMAIL })).toBe(false);
    expect(await sendAccountLockedAlert(deps, { email: EMAIL, minutes: 15 })).toBe(false);
    expect(errors).toEqual(["EmailDeliveryError", "EmailDeliveryError"]);
  });
});

describe("buildEmailChangedEmail", () => {
  it("part vers l'ancienne adresse, nomme la nouvelle, sans aucun lien", () => {
    const message = buildEmailChangedEmail({
      previousEmail: "ancienne@example.test",
      newEmail: "nouvelle@example.test",
    });
    expect(message.to).toBe("ancienne@example.test");
    expect(message.text).toContain("nouvelle@example.test");
    expect(message.text).not.toMatch(/https?:\/\//);
    expect(message.html).not.toContain("<a ");
  });

  it("échappe la nouvelle adresse dans le HTML", () => {
    const message = buildEmailChangedEmail({
      previousEmail: "a@example.test",
      newEmail: "<b>x</b>@example.test",
    });
    expect(message.html).not.toContain("<b>x</b>");
  });
});

describe("buildAccountDeletionScheduledEmail", () => {
  it("cible le compte, donne la date d'effacement et renvoie vers l'administrateur", () => {
    const message = buildAccountDeletionScheduledEmail({ email: EMAIL, date: "09/12/2026" });
    expect(message.to).toBe(EMAIL);
    expect(message.subject).toBe("Suppression de votre compte REF-Archives");
    expect(message.text).toContain("09/12/2026");
    expect(message.text).toContain("contactez l'administrateur");
  });

  it("ne contient aucun lien (anti-hameçonnage, §6.6)", () => {
    const message = buildAccountDeletionScheduledEmail({ email: EMAIL, date: "09/12/2026" });
    expect(message.text).not.toContain("http");
    expect(message.html).not.toContain("<a ");
  });
});

describe("sendAccountDeletionScheduledAlert", () => {
  it("envoie l'alerte et renvoie vrai", async () => {
    const { sent, send } = recorder();
    expect(
      await sendAccountDeletionScheduledAlert(
        { send, onError: () => undefined },
        { email: EMAIL, date: "09/12/2026" },
      ),
    ).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("un échec d'envoi renvoie faux sans lever, et ne transmet que le nom de l'erreur", async () => {
    const errors: string[] = [];
    expect(
      await sendAccountDeletionScheduledAlert(
        {
          send: () => Promise.reject(new EmailDeliveryError(EMAIL)),
          onError: (name) => errors.push(name),
        },
        { email: EMAIL, date: "09/12/2026" },
      ),
    ).toBe(false);
    expect(errors).toEqual(["EmailDeliveryError"]);
  });
});
