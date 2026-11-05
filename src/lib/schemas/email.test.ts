import { describe, expect, it } from "vitest";
import { EmailMessageSchema } from "./email";

const valid = { to: "arbitre@example.com", subject: "Bonjour", text: "Contenu" };

describe("EmailMessageSchema", () => {
  it("accepte un message minimal", () => {
    expect(EmailMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepte un corps HTML", () => {
    expect(EmailMessageSchema.safeParse({ ...valid, html: "<p>Contenu</p>" }).success).toBe(true);
  });

  it("refuse une adresse invalide", () => {
    expect(EmailMessageSchema.safeParse({ ...valid, to: "pas-un-email" }).success).toBe(false);
  });

  it("refuse une adresse contenant un saut de ligne", () => {
    expect(
      EmailMessageSchema.safeParse({ ...valid, to: "a@example.com\r\nBcc: b@example.com" }).success,
    ).toBe(false);
  });

  it("refuse un sujet contenant un saut de ligne (injection d'en-tête)", () => {
    expect(
      EmailMessageSchema.safeParse({ ...valid, subject: "Bonjour\r\nBcc: x@example.com" }).success,
    ).toBe(false);
  });

  it("refuse un sujet vide ou trop long", () => {
    expect(EmailMessageSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
    expect(EmailMessageSchema.safeParse({ ...valid, subject: "a".repeat(201) }).success).toBe(
      false,
    );
  });

  it("refuse un texte vide", () => {
    expect(EmailMessageSchema.safeParse({ ...valid, text: "" }).success).toBe(false);
  });
});
