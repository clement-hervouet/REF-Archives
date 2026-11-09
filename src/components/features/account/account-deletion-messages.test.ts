import { describe, expect, it } from "vitest";
import { accountDeletionMessage } from "./account-deletion-messages";

describe("accountDeletionMessage", () => {
  it("rien avant l'envoi", () => {
    expect(accountDeletionMessage({ status: "idle" })).toBeNull();
  });

  it("une erreur par refus", () => {
    expect(accountDeletionMessage({ status: "invalid" })).toEqual({
      tone: "error",
      text: "Saisissez votre mot de passe.",
    });
    expect(accountDeletionMessage({ status: "wrong_password" })?.text).toBe(
      "Mot de passe incorrect.",
    );
    expect(accountDeletionMessage({ status: "last_admin" })?.tone).toBe("error");
    expect(accountDeletionMessage({ status: "not_found" })?.tone).toBe("error");
  });

  it("indique le délai d'attente en minutes", () => {
    expect(accountDeletionMessage({ status: "rate_limited", retryAfterMinutes: 12 })?.text).toBe(
      "Trop de tentatives. Réessayez dans 12 min.",
    );
  });
});
