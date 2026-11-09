import { describe, expect, it } from "vitest";
import {
  blockMessage,
  deletionMessage,
  detailsFieldError,
  detailsMessage,
  passwordLinkMessage,
} from "./account-messages";

describe("detailsMessage", () => {
  it("succès avec ou sans alerte à l'ancienne adresse", () => {
    expect(detailsMessage({ status: "updated", alertSent: null })?.text).toBe(
      "Informations enregistrées.",
    );
    expect(detailsMessage({ status: "updated", alertSent: true })?.text).toContain(
      "ancienne adresse a reçu",
    );
    expect(detailsMessage({ status: "updated", alertSent: false })).toMatchObject({
      tone: "error",
    });
  });

  it("refus explicites", () => {
    expect(detailsMessage({ status: "last_admin" })?.text).toContain("dernier administrateur");
    expect(detailsMessage({ status: "self_demotion" })?.text).toContain("vos propres droits");
  });
});

describe("detailsFieldError", () => {
  it("email invalide ou déjà pris, sous le champ email", () => {
    expect(detailsFieldError({ status: "invalid", issues: ["email.invalid"] }, "email")).toBe(
      "Saisissez une adresse email valide.",
    );
    expect(detailsFieldError({ status: "email_taken" }, "email")).toBe(
      "Un autre compte utilise déjà cette adresse.",
    );
    expect(detailsFieldError({ status: "invalid", issues: ["email.invalid"] }, "role")).toBeNull();
  });
});

describe("blockMessage", () => {
  it("date de fin ou sans fin", () => {
    expect(blockMessage({ status: "blocked", until: "2026-11-14T23:00:00.000Z" })?.text).toBe(
      "Compte bloqué jusqu'au 15/11/2026 00:00. Il a été déconnecté partout.",
    );
    expect(blockMessage({ status: "blocked", until: null })?.text).toContain("jusqu'à déblocage");
    expect(blockMessage({ status: "invalid", issue: "date.past" })?.text).toBe(
      "Choisissez une date à partir de demain.",
    );
  });
});

describe("deletionMessage / passwordLinkMessage", () => {
  it("date de suppression, confirmation, lien envoyé", () => {
    expect(
      deletionMessage({ status: "scheduled", dueAt: "2026-12-08T19:00:00.000Z" })?.text,
    ).toContain("08/12/2026 20:00");
    expect(deletionMessage({ status: "confirmation_mismatch" })?.text).toContain(
      "ne correspond pas",
    );
    expect(
      passwordLinkMessage({ status: "sent", email: "a@example.test", emailSent: true })?.text,
    ).toBe("Lien envoyé à a@example.test. Il est valable 30 minutes.");
  });
});
